mod backup;
mod db;

use db::{
    Category, FoundInput, FoundItem, InventoryPage, LostInput, LostReport, Organization,
    SetupInput, StorageLocation,
};
use rusqlite::{Connection, OptionalExtension, params};
use serde::Serialize;
use std::{
    io::Cursor,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{Manager, State};
use tauri_plugin_dialog::DialogExt;

struct AppState {
    db: Mutex<Connection>,
    _data_dir: PathBuf,
}

fn with_db<T>(
    state: &State<'_, AppState>,
    f: impl FnOnce(&Connection) -> Result<T, String>,
) -> Result<T, String> {
    let db = state
        .db
        .lock()
        .map_err(|_| "The database is busy. Please try again.".to_string())?;
    f(&db)
}
fn with_db_mut<T>(
    state: &State<'_, AppState>,
    f: impl FnOnce(&mut Connection) -> Result<T, String>,
) -> Result<T, String> {
    let mut db = state
        .db
        .lock()
        .map_err(|_| "The database is busy. Please try again.".to_string())?;
    f(&mut db)
}

fn managed_photo_path(data_dir: &Path, relative: &str) -> Result<PathBuf, String> {
    let relative_path = Path::new(relative);
    if relative_path.is_absolute()
        || relative_path
            .components()
            .any(|component| !matches!(component, std::path::Component::Normal(_)))
        || relative_path.components().next() != Some(std::path::Component::Normal("photos".as_ref()))
    {
        return Err("Invalid photo reference.".into());
    }

    let photo_root = data_dir.join("photos");
    let mut current = data_dir.to_path_buf();
    for component in relative_path.components() {
        let std::path::Component::Normal(part) = component else {
            return Err("Invalid photo reference.".into());
        };
        current.push(part);
        let metadata = std::fs::symlink_metadata(&current)
            .map_err(|_| "Stored photo is missing.".to_string())?;
        if metadata.file_type().is_symlink() {
            return Err("Photo storage cannot contain linked files.".into());
        }
    }

    let canonical_root = std::fs::canonicalize(photo_root)
        .map_err(|_| "Photo storage is missing.".to_string())?;
    let canonical_path = std::fs::canonicalize(current)
        .map_err(|_| "Stored photo is missing.".to_string())?;
    if !canonical_path.starts_with(canonical_root) || !canonical_path.is_file() {
        return Err("Invalid photo reference.".into());
    }
    Ok(canonical_path)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Bootstrap {
    organization: Option<Organization>,
    categories: Vec<Category>,
    storage_locations: Vec<StorageLocation>,
    stats: db::DashboardStats,
}

#[tauri::command]
fn bootstrap(state: State<'_, AppState>) -> Result<Bootstrap, String> {
    with_db(&state, |conn| {
        Ok(Bootstrap {
            organization: db::organization(conn)?,
            categories: db::categories(conn, true)?,
            storage_locations: db::storage_locations(conn, true)?,
            stats: db::dashboard_stats(conn)?,
        })
    })
}

#[tauri::command]
fn complete_setup(state: State<'_, AppState>, input: SetupInput) -> Result<Organization, String> {
    with_db_mut(&state, |conn| db::create_organization(conn, input))
}

#[tauri::command]
fn list_categories(
    state: State<'_, AppState>,
    include_archived: bool,
) -> Result<Vec<Category>, String> {
    with_db(&state, |conn| db::categories(conn, include_archived))
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct CategoryInput {
    id: Option<String>,
    name: String,
    description: String,
    icon: String,
    retention_days: Option<i64>,
}

#[tauri::command]
fn save_category(state: State<'_, AppState>, input: CategoryInput) -> Result<Category, String> {
    with_db_mut(&state, |conn| {
        if input.name.trim().is_empty() {
            return Err("Category name is required.".into());
        }
        if input
            .retention_days
            .is_some_and(|days| !(1..=3650).contains(&days))
        {
            return Err("Retention must be between 1 and 3650 days.".into());
        }
        let now = db::now();
        let id = input.id.unwrap_or_else(db::new_id);
        conn.execute("INSERT INTO categories(id,name,description,icon,active,sort_order,retention_days,created_at,updated_at) VALUES(?1,?2,?3,?4,1,COALESCE((SELECT MAX(sort_order)+1 FROM categories),0),?5,?6,?6) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,icon=excluded.icon,retention_days=excluded.retention_days,updated_at=excluded.updated_at",params![id,input.name.trim(),input.description,input.icon,input.retention_days,now]).map_err(db::db_error)?;
        conn.query_row("SELECT id,name,description,icon,active,sort_order,retention_days FROM categories WHERE id=?1",[id],|r|Ok(Category{id:r.get(0)?,name:r.get(1)?,description:r.get(2)?,icon:r.get(3)?,active:r.get::<_,i64>(4)?!=0,sort_order:r.get(5)?,retention_days:r.get(6)?})).map_err(db::db_error)
    })
}

#[tauri::command]
fn set_category_active(state: State<'_, AppState>, id: String, active: bool) -> Result<(), String> {
    with_db(&state, |conn| {
        conn.execute(
            "UPDATE categories SET active=?1,updated_at=?2 WHERE id=?3",
            params![active as i64, db::now(), id],
        )
        .map_err(db::db_error)?;
        Ok(())
    })
}

#[tauri::command]
fn reorder_categories(state: State<'_, AppState>, ids: Vec<String>) -> Result<(), String> {
    with_db_mut(&state, |conn| {
        let tx = conn.unchecked_transaction().map_err(db::db_error)?;
        for (order, id) in ids.iter().enumerate() {
            tx.execute(
                "UPDATE categories SET sort_order=?1,updated_at=?2 WHERE id=?3",
                params![order as i64, db::now(), id],
            )
            .map_err(db::db_error)?;
        }
        tx.commit().map_err(db::db_error)
    })
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct StorageInput {
    id: Option<String>,
    name: String,
    description: String,
    parent_id: Option<String>,
    secure: bool,
    organization_location_id: Option<String>,
}

#[tauri::command]
fn save_storage_location(
    state: State<'_, AppState>,
    input: StorageInput,
) -> Result<StorageLocation, String> {
    with_db_mut(&state, |conn| {
        if input.name.trim().is_empty() {
            return Err("Storage location name is required.".into());
        }
        if let Some(parent_id) = &input.parent_id {
            let active: Option<i64> = conn
                .query_row(
                    "SELECT active FROM storage_locations WHERE id=?1",
                    [parent_id],
                    |r| r.get(0),
                )
                .optional()
                .map_err(db::db_error)?;
            if active != Some(1) {
                return Err("Choose an active parent location.".into());
            }
            if let Some(id) = &input.id {
                let cycle:bool=conn.query_row("WITH RECURSIVE parents(id) AS (SELECT ?1 UNION SELECT s.parent_id FROM storage_locations s JOIN parents p ON s.id=p.id WHERE s.parent_id IS NOT NULL) SELECT EXISTS(SELECT 1 FROM parents WHERE id=?2)",[parent_id,id],|r|r.get(0)).map_err(db::db_error)?;
                if cycle {
                    return Err(
                        "A location cannot be nested inside itself or one of its descendants."
                            .into(),
                    );
                }
            }
        }
        if let Some(site_id) = &input.organization_location_id {
            let active: Option<i64> = conn
                .query_row(
                    "SELECT active FROM organization_locations WHERE id=?1",
                    [site_id],
                    |r| r.get(0),
                )
                .optional()
                .map_err(db::db_error)?;
            if active != Some(1) {
                return Err("Choose an active organization location.".into());
            }
        }
        if input
            .id
            .as_ref()
            .zip(input.parent_id.as_ref())
            .is_some_and(|(id, parent)| id == parent)
        {
            return Err("A storage location cannot be its own parent.".into());
        }
        let id = input.id.unwrap_or_else(db::new_id);
        let now = db::now();
        conn.execute("INSERT INTO storage_locations(id,name,description,parent_id,organization_location_id,secure,sort_order,created_at) VALUES(?1,?2,?3,?4,?5,?6,COALESCE((SELECT MAX(sort_order)+1 FROM storage_locations),0),?7) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,parent_id=excluded.parent_id,secure=excluded.secure,organization_location_id=excluded.organization_location_id",params![id,input.name.trim(),input.description,input.parent_id,input.organization_location_id,input.secure as i64,now]).map_err(db::db_error)?;
        db::storage_locations(conn, true)?
            .into_iter()
            .find(|v| v.id == id)
            .ok_or_else(|| "Storage location could not be loaded.".into())
    })
}

#[tauri::command]
fn set_storage_active(state: State<'_, AppState>, id: String, active: bool) -> Result<(), String> {
    with_db(&state, |conn| {
        conn.execute(
            "UPDATE storage_locations SET active=?1 WHERE id=?2",
            params![active as i64, id],
        )
        .map_err(db::db_error)?;
        Ok(())
    })
}

#[tauri::command]
fn list_organization_locations(
    state: State<'_, AppState>,
    include_inactive: bool,
) -> Result<Vec<db::OrganizationLocation>, String> {
    with_db(&state, |conn| {
        db::organization_locations(conn, include_inactive)
    })
}
#[tauri::command]
fn save_organization_location(
    state: State<'_, AppState>,
    input: db::OrganizationLocationInput,
) -> Result<db::OrganizationLocation, String> {
    with_db_mut(&state, |conn| db::save_organization_location(conn, input))
}
#[tauri::command]
fn set_organization_location_active(
    state: State<'_, AppState>,
    id: String,
    active: bool,
) -> Result<(), String> {
    with_db(&state, |conn| {
        db::set_organization_location_active(conn, &id, active)
    })
}

#[tauri::command]
fn delete_storage_location(state: State<'_, AppState>, id: String) -> Result<(), String> {
    with_db(&state, |conn| {
        let contents:i64=conn.query_row("SELECT count(*) FROM found_items WHERE storage_location_id=?1 AND status='in_custody'",[&id],|r|r.get(0)).map_err(db::db_error)?;
        if contents > 0 {
            return Err("Move the items out of this location before deleting it.".into());
        }
        let children: i64 = conn
            .query_row(
                "SELECT count(*) FROM storage_locations WHERE parent_id=?1",
                [&id],
                |r| r.get(0),
            )
            .map_err(db::db_error)?;
        if children > 0 {
            return Err("Move child locations before deleting this location.".into());
        }
        conn.execute("DELETE FROM storage_locations WHERE id=?1", [id])
            .map_err(db::db_error)?;
        Ok(())
    })
}

#[tauri::command]
fn list_found_items(
    state: State<'_, AppState>,
    query: String,
    category_id: Option<String>,
    storage_location_id: Option<String>,
    status: String,
    date_from: String,
    date_to: String,
    page: u32,
    page_size: u32,
) -> Result<InventoryPage, String> {
    with_db(&state, |conn| {
        db::list_found(
            conn,
            &query,
            category_id.as_deref(),
            storage_location_id.as_deref(),
            &status,
            &date_from,
            &date_to,
            page,
            page_size,
        )
    })
}

#[tauri::command]
fn create_found_item(state: State<'_, AppState>, input: FoundInput) -> Result<FoundItem, String> {
    with_db_mut(&state, |conn| db::create_found(conn, input))
}

#[tauri::command]
fn update_found_item(
    state: State<'_, AppState>,
    id: String,
    input: FoundInput,
) -> Result<FoundItem, String> {
    with_db_mut(&state, |conn| db::update_found(conn, &id, input))
}

#[tauri::command]
fn move_found_item(
    state: State<'_, AppState>,
    id: String,
    storage_location_id: String,
) -> Result<(), String> {
    with_db_mut(&state, |conn| {
        let staff = db::current_staff_name(conn).unwrap_or_default();
        db::move_found(conn, &id, &storage_location_id, &staff)
    })
}

#[tauri::command]
fn return_found_item(state: State<'_, AppState>, input: db::ReturnInput) -> Result<(), String> {
    with_db_mut(&state, |conn| {
        let required = db::organization(conn)?.is_some_and(|org| org.require_verification);
        let staff = db::current_staff_name(conn).unwrap_or_default();
        db::return_found(conn, input, required, &staff)
    })
}

#[tauri::command]
fn dispose_found_item(
    state: State<'_, AppState>,
    id: String,
    method: String,
) -> Result<(), String> {
    with_db_mut(&state, |conn| {
        let staff = db::current_staff_name(conn).unwrap_or_default();
        db::dispose_found(conn, &id, &method, &staff)
    })
}

#[tauri::command]
fn matching_candidates(
    state: State<'_, AppState>,
    lost_report_id: String,
) -> Result<Vec<db::MatchCandidate>, String> {
    with_db_mut(&state, |conn| db::match_candidates(conn, &lost_report_id))
}

#[tauri::command]
fn review_match(
    state: State<'_, AppState>,
    lost_report_id: String,
    found_item_id: String,
    status: String,
) -> Result<(), String> {
    with_db_mut(&state, |conn| {
        db::review_match(conn, &lost_report_id, &found_item_id, &status)
    })
}

#[tauri::command]
fn adjudicate_match(
    state: State<'_, AppState>,
    lost_report_id: String,
    found_item_id: String,
) -> Result<(), String> {
    with_db_mut(&state, |conn| {
        db::adjudicate_match(conn, &lost_report_id, &found_item_id)
    })
}

#[tauri::command]
fn item_activity(
    state: State<'_, AppState>,
    record_type: String,
    record_id: String,
) -> Result<Vec<db::ActivityEvent>, String> {
    with_db(&state, |conn| {
        let mut statement=conn.prepare("SELECT id,record_type,record_id,event_type,happened_at,staff_name,details FROM custody_events WHERE record_type=?1 AND record_id=?2 ORDER BY happened_at DESC LIMIT 100").map_err(db::db_error)?;
        statement
            .query_map(params![record_type, record_id], |r| {
                Ok(db::ActivityEvent {
                    id: r.get(0)?,
                    record_type: r.get(1)?,
                    record_id: r.get(2)?,
                    event_type: r.get(3)?,
                    happened_at: r.get(4)?,
                    staff_name: r.get(5)?,
                    details: r.get(6)?,
                })
            })
            .map_err(db::db_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(db::db_error)
    })
}

fn decode_photo_data_url(photo_data_url: &str) -> Result<(Vec<u8>, image::ImageFormat), String> {
    let (header, encoded) = photo_data_url
        .split_once(',')
        .ok_or_else(|| "Choose a PNG, JPEG, or WebP image.".to_string())?;
    let declared_mime = match header {
        "data:image/png;base64" => ("image/png", image::ImageFormat::Png),
        "data:image/jpeg;base64" => ("image/jpeg", image::ImageFormat::Jpeg),
        "data:image/webp;base64" => ("image/webp", image::ImageFormat::WebP),
        _ => return Err("Choose a PNG, JPEG, or WebP image.".into()),
    };
    if encoded.len() > 20 * 1024 * 1024 {
        return Err("Choose an image smaller than 15 MB.".into());
    }
    let bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, encoded)
        .map_err(|_| "Choose a PNG, JPEG, or WebP image.".to_string())?;
    if bytes.is_empty() || bytes.len() > 15 * 1024 * 1024 {
        return Err("Choose an image smaller than 15 MB.".into());
    }
    Ok((bytes, declared_mime.1))
}

#[tauri::command]
fn import_item_photo(
    state: State<'_, AppState>,
    item_id: String,
    photo_data_url: String,
) -> Result<db::PhotoRecord, String> {
    if uuid::Uuid::parse_str(&item_id).is_err() {
        return Err("Invalid item reference.".into());
    }
    let (bytes, declared_format) = decode_photo_data_url(&photo_data_url)?;
    let mut reader = image::ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|_| "Choose a PNG, JPEG, or WebP image.".to_string())?;
    let format = reader
        .format()
        .ok_or_else(|| "Choose a PNG, JPEG, or WebP image.".to_string())?;
    if !matches!(
        format,
        image::ImageFormat::Png | image::ImageFormat::Jpeg | image::ImageFormat::WebP
    ) {
        return Err("Choose a PNG, JPEG, or WebP image.".into());
    }
    if format != declared_format {
        return Err("The selected image type does not match its contents.".into());
    }
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(12000);
    limits.max_image_height = Some(12000);
    limits.max_alloc = Some(256 * 1024 * 1024);
    reader.limits(limits);
    let image = reader
        .decode()
        .map_err(|e| format!("That image could not be decoded: {e}"))?;
    let photo_id = db::new_id();
    let relative_dir = PathBuf::from("photos").join(&item_id);
    let directory = state._data_dir.join(&relative_dir);
    let photo_root = state._data_dir.join("photos");
    if std::fs::symlink_metadata(&photo_root)
        .is_ok_and(|metadata| metadata.file_type().is_symlink())
    {
        return Err("Photo storage cannot contain linked files.".into());
    }
    std::fs::create_dir_all(&directory)
        .map_err(|e| format!("Could not create photo storage: {e}"))?;
    if std::fs::symlink_metadata(&directory)
        .map_err(|e| format!("Could not inspect photo storage: {e}"))?
        .file_type()
        .is_symlink()
    {
        return Err("Photo storage cannot contain linked files.".into());
    }
    let original_rel = relative_dir.join(format!("{photo_id}.jpg"));
    let thumb_rel = relative_dir.join(format!("{photo_id}-thumb.jpg"));
    let original_path = state._data_dir.join(&original_rel);
    let thumb_path = state._data_dir.join(&thumb_rel);
    let mut original = Cursor::new(Vec::new());
    image
        .write_to(&mut original, image::ImageFormat::Jpeg)
        .map_err(|e| format!("Could not prepare photo: {e}"))?;
    let thumb = image.thumbnail(520, 520);
    let mut thumbnail = Cursor::new(Vec::new());
    thumb
        .write_to(&mut thumbnail, image::ImageFormat::Jpeg)
        .map_err(|e| format!("Could not create photo preview: {e}"))?;
    std::fs::write(&original_path, original.get_ref())
        .map_err(|e| format!("Could not save photo: {e}"))?;
    if let Err(error) = std::fs::write(&thumb_path, thumbnail.get_ref()) {
        let _ = std::fs::remove_file(&original_path);
        return Err(format!("Could not save photo preview: {error}"));
    }
    let record = with_db_mut(&state, |conn| {
        db::register_photo(
            conn,
            &item_id,
            &original_rel.to_string_lossy(),
            &thumb_rel.to_string_lossy(),
            "image/jpeg",
            original.get_ref().len() as i64,
        )
    });
    match record {
        Ok(v) => Ok(v),
        Err(e) => {
            let _ = std::fs::remove_file(&original_path);
            let _ = std::fs::remove_file(&thumb_path);
            Err(e)
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PhotoPreview {
    id: String,
    data_url: String,
}

#[tauri::command]
fn item_photos(state: State<'_, AppState>, item_id: String) -> Result<Vec<PhotoPreview>, String> {
    let paths = with_db(&state, |conn| db::photo_paths(conn, &item_id))?;
    paths
        .into_iter()
        .map(|(id, relative)| {
            let path = managed_photo_path(&state._data_dir, &relative)?;
            let bytes =
                std::fs::read(path).map_err(|e| format!("Could not read stored photo: {e}"))?;
            Ok(PhotoPreview {
                id,
                data_url: format!(
                    "data:image/jpeg;base64,{}",
                    base64::Engine::encode(&base64::engine::general_purpose::STANDARD, bytes)
                ),
            })
        })
        .collect()
}

#[tauri::command]
fn remove_item_photo(state: State<'_, AppState>, photo_id: String) -> Result<(), String> {
    let removed = with_db_mut(&state, |conn| db::remove_photo_record(conn, &photo_id))?;
    if let Some((_, original, thumbnail)) = removed {
        for relative in [original, thumbnail] {
            if !relative.is_empty() {
                if let Ok(path) = managed_photo_path(&state._data_dir, &relative) {
                    let _ = std::fs::remove_file(path);
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
async fn export_backup(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<backup::Manifest>, String> {
    let suggested_name = format!(
        "reclaim-backup-{}.reclaim.zip",
        chrono::Utc::now().format("%Y-%m-%d")
    );
    let selected = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .add_filter("Reclaim backup", &["reclaim.zip", "zip"])
            .set_file_name(suggested_name)
            .blocking_save_file()
    })
    .await
    .map_err(|e| format!("Could not open backup destination dialog: {e}"))?;
    let Some(selected) = selected else {
        return Ok(None);
    };
    let path = selected
        .into_path()
        .map_err(|_| "Choose a valid backup destination.".to_string())?;
    with_db(&state, |conn| backup::create(conn, &state._data_dir, &path)).map(Some)
}

fn recover_interrupted_restore(data_dir: &Path) -> Result<(), String> {
    let marker = data_dir.join("restore.in-progress");
    if !marker.exists() {
        return Ok(());
    }
    let state = std::fs::read_to_string(&marker).map_err(|e| format!("Could not read restore recovery state: {e}"))?;
    let database = data_dir.join("reclaim.sqlite3");
    let old_database = data_dir.join("reclaim.sqlite3.restore-previous");
    let photos = data_dir.join("photos");
    let old_photos = data_dir.join("photos.restore-previous");
    if state.trim() == "committed" {
        if old_database.exists() {
            std::fs::remove_file(&old_database).map_err(|e| e.to_string())?;
        }
        if old_photos.exists() {
            std::fs::remove_dir_all(&old_photos).map_err(|e| e.to_string())?;
        }
    } else if old_database.exists() {
        if database.exists() {
            std::fs::remove_file(&database).map_err(|e| e.to_string())?;
        }
        std::fs::rename(&old_database, &database)
            .map_err(|e| format!("Could not recover the previous database: {e}"))?;
        if old_photos.exists() {
            if photos.exists() {
                std::fs::remove_dir_all(&photos).map_err(|e| e.to_string())?;
            }
            std::fs::rename(&old_photos, &photos)
                .map_err(|e| format!("Could not recover previous item photos: {e}"))?;
        } else if state.trim() == "pending:photos=0" && photos.exists() {
            std::fs::remove_dir_all(&photos).map_err(|e| e.to_string())?;
        }
    }
    let _ = std::fs::remove_file(data_dir.join("reclaim.sqlite3-wal"));
    let _ = std::fs::remove_file(data_dir.join("reclaim.sqlite3-shm"));
    for entry in std::fs::read_dir(data_dir).map_err(|e| e.to_string())? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path
            .file_name()
            .is_some_and(|n| n.to_string_lossy().starts_with(".restore-"))
        {
            let _ = std::fs::remove_dir_all(path);
        }
    }
    std::fs::remove_file(marker).map_err(|e| e.to_string())?;
    Ok(())
}

fn mark_restore_committed(data_dir: &Path) -> Result<(), String> {
    let marker = data_dir.join("restore.in-progress");
    let temporary = data_dir.join(".restore-commit-marker.tmp");
    let mut file = std::fs::File::create(&temporary).map_err(|e| e.to_string())?;
    use std::io::Write;
    file.write_all(b"committed").map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())?;
    std::fs::rename(&temporary, &marker).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn restore_backup(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<bool, String> {
    let selected = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .add_filter("Reclaim backup", &["reclaim.zip", "zip"])
            .blocking_pick_file()
    })
    .await
    .map_err(|e| format!("Could not open backup selection dialog: {e}"))?;
    let Some(selected) = selected else {
        return Ok(false);
    };
    let source = selected
        .into_path()
        .map_err(|_| "Choose a valid Reclaim backup.".to_string())?;
    let stage = backup::stage_restore(&source, &state._data_dir)?;
    let db_path = state._data_dir.join("reclaim.sqlite3");
    let previous_db = state._data_dir.join("reclaim.sqlite3.restore-previous");
    let photos = state._data_dir.join("photos");
    let previous_photos = state._data_dir.join("photos.restore-previous");
    let marker = state._data_dir.join("restore.in-progress");
    let staged_db = stage.join("database.sqlite3");
    let staged_photos = stage.join("photos");

    let mut current = match state.db.lock() {
        Ok(value) => value,
        Err(_) => {
            let _ = std::fs::remove_dir_all(&stage);
            return Err("The database is busy. Please try again.".into());
        }
    };
    if let Err(error) =
        current.execute_batch("PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE;")
    {
        let _ = std::fs::remove_dir_all(&stage);
        return Err(db::db_error(error));
    }
    let placeholder = match Connection::open_in_memory() {
        Ok(value) => value,
        Err(error) => {
            let _ = std::fs::remove_dir_all(&stage);
            return Err(db::db_error(error));
        }
    };
    let old = std::mem::replace(&mut *current, placeholder);
    drop(old);

    let install = (|| -> Result<Connection, String> {
        let had_photos = photos.exists();
        std::fs::write(&marker, if had_photos { b"pending:photos=1" } else { b"pending:photos=0" }).map_err(|e| e.to_string())?;
        if previous_db.exists() {
            std::fs::remove_file(&previous_db).map_err(|e| e.to_string())?;
        }
        if previous_photos.exists() {
            std::fs::remove_dir_all(&previous_photos).map_err(|e| e.to_string())?;
        }
        std::fs::rename(&db_path, &previous_db)
            .map_err(|e| format!("Could not preserve the current database: {e}"))?;
        if photos.exists() {
            std::fs::rename(&photos, &previous_photos)
                .map_err(|e| format!("Could not preserve current photos: {e}"))?;
        }
        std::fs::rename(&staged_db, &db_path)
            .map_err(|e| format!("Could not install restored database: {e}"))?;
        if staged_photos.exists() {
            std::fs::rename(&staged_photos, &photos)
                .map_err(|e| format!("Could not install restored photos: {e}"))?;
        }
        let restored = db::open_database(&db_path)?;
        mark_restore_committed(&state._data_dir)?;
        Ok(restored)
    })();

    let result = match install {
        Ok(restored) => {
            *current = restored;
            let _ = std::fs::remove_file(&previous_db);
            let _ = std::fs::remove_dir_all(&previous_photos);
            let _ = std::fs::remove_file(&marker);
            Ok(true)
        }
        Err(error) => {
            let recovery = recover_interrupted_restore(&state._data_dir);
            match db::open_database(&db_path) {
                Ok(recovered) => {
                    *current = recovered;
                    match recovery {
                        Ok(()) => Err(format!(
                            "Restore failed and the previous workspace was recovered: {error}"
                        )),
                        Err(recovery_error) => Err(format!(
                            "Restore failed: {error}. Recovery also reported: {recovery_error}"
                        )),
                    }
                }
                Err(recovery_error) => Err(format!(
                    "Restore failed: {error}. The previous database could not be reopened: {recovery_error}"
                )),
            }
        }
    };
    let _ = std::fs::remove_dir_all(&stage);
    result
}

#[tauri::command]
fn create_lost_report(state: State<'_, AppState>, input: LostInput) -> Result<LostReport, String> {
    with_db_mut(&state, |conn| {
        if conn
            .query_row(
                "SELECT active FROM categories WHERE id=?1",
                [&input.category_id],
                |r| r.get::<_, i64>(0),
            )
            .optional()
            .map_err(db::db_error)?
            != Some(1)
        {
            return Err("Choose an active item category.".into());
        }
        db::create_lost(conn, input)
    })
}

#[tauri::command]
fn update_lost_report(
    state: State<'_, AppState>,
    id: String,
    input: LostInput,
) -> Result<LostReport, String> {
    with_db_mut(&state, |conn| {
        let active: bool = conn.query_row("SELECT EXISTS(SELECT 1 FROM categories WHERE id=?1 AND (active=1 OR id=(SELECT category_id FROM lost_reports WHERE id=?2)))", params![input.category_id,id], |r|r.get(0)).map_err(db::db_error)?;
        if !active {
            return Err("Choose an active item category.".into());
        }
        db::update_lost(conn, &id, input)
    })
}

#[tauri::command]
fn set_lost_report_status(
    state: State<'_, AppState>,
    id: String,
    status: String,
) -> Result<(), String> {
    with_db_mut(&state, |conn| db::set_lost_status(conn, &id, &status))
}

#[tauri::command]
fn list_lost_reports(
    state: State<'_, AppState>,
    query: String,
    status: String,
) -> Result<Vec<LostReport>, String> {
    with_db(&state, |conn| {
        let needle = format!("%{}%", query.trim());
        let status = if status == "all" { "%" } else { &status };
        let mut statement=conn.prepare("SELECT r.id,r.reference,r.name,r.category_id,c.name,r.description,r.color,r.brand,r.lost_at,r.last_location,r.claimant_name,r.contact,r.notes,r.status,r.created_at FROM lost_reports r JOIN categories c ON c.id=r.category_id WHERE (?1='' OR r.reference LIKE ?2 OR r.name LIKE ?2 OR r.description LIKE ?2 OR r.last_location LIKE ?2 OR r.claimant_name LIKE ?2) AND (?3='%' OR r.status=?3) ORDER BY r.lost_at DESC LIMIT 250").map_err(db::db_error)?;
        statement
            .query_map(params![query.trim(), needle, status], |r| {
                Ok(LostReport {
                    id: r.get(0)?,
                    reference: r.get(1)?,
                    name: r.get(2)?,
                    category_id: r.get(3)?,
                    category_name: r.get(4)?,
                    description: r.get(5)?,
                    color: r.get(6)?,
                    brand: r.get(7)?,
                    lost_at: r.get(8)?,
                    last_location: r.get(9)?,
                    claimant_name: r.get(10)?,
                    contact: r.get(11)?,
                    notes: r.get(12)?,
                    status: r.get(13)?,
                    created_at: r.get(14)?,
                })
            })
            .map_err(db::db_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(db::db_error)
    })
}

#[tauri::command]
fn dashboard_stats(state: State<'_, AppState>) -> Result<db::DashboardStats, String> {
    with_db(&state, db::dashboard_stats)
}

#[tauri::command]
fn retention_queue(state: State<'_, AppState>) -> Result<Vec<db::RetentionRecord>, String> {
    with_db(&state, db::retention_queue)
}

#[tauri::command]
fn update_organization(
    state: State<'_, AppState>,
    organization: Organization,
) -> Result<Organization, String> {
    with_db(&state, |conn| {
        if organization.name.trim().is_empty() {
            return Err("Organization name is required.".into());
        }
        if organization.staff_name.trim().is_empty() || organization.staff_name.trim().len() > 80 {
            return Err("Enter a staff name between 1 and 80 characters.".into());
        }
        if !["light", "dark", "system"].contains(&organization.theme.as_str()) {
            return Err("Choose a valid appearance theme.".into());
        }
        if !db::valid_operating_hours(&organization.operating_hours) {
            return Err(
                "Configure valid hours for each day. Mark overnight hours explicitly.".into(),
            );
        }
        if !db::valid_brand_color(&organization.primary_color) {
            return Err("Enter a valid accessible brand color in #RRGGBB format.".into());
        }
        if organization.logo_data_url.as_ref().is_some_and(|logo| {
            logo.len() > 3_000_000
                || !([
                    "data:image/png;base64,",
                    "data:image/jpeg;base64,",
                    "data:image/webp;base64,",
                ]
                .iter()
                .any(|p| logo.starts_with(p)))
        }) {
            return Err("Choose a PNG, JPEG, or WebP logo smaller than 2 MB.".into());
        }
        conn.execute("UPDATE organization SET name=?1,organization_type=?2,phone=?3,email=?4,street=?5,city=?6,region=?7,postal_code=?8,country=?9,operating_hours_json=?10,locale=?11,date_format=?12,retention_days=?13,require_verification=?14,allow_anonymous_finders=?15,theme=?16,primary_color=?17,logo_data_url=?18,staff_name=?19,updated_at=?20 WHERE id=?21",params![organization.name.trim(),organization.organization_type,organization.phone,organization.email,organization.street,organization.city,organization.region,organization.postal_code,organization.country,organization.operating_hours,organization.locale,organization.date_format,organization.retention_days,organization.require_verification as i64,organization.allow_anonymous_finders as i64,organization.theme,organization.primary_color,organization.logo_data_url,organization.staff_name.trim(),db::now(),organization.id]).map_err(db::db_error)?;
        db::organization(conn)?.ok_or_else(|| "Organization has not been set up yet.".into())
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            recover_interrupted_restore(&data_dir).map_err(std::io::Error::other)?;
            let connection = db::open_database(&data_dir.join("reclaim.sqlite3"))
                .map_err(std::io::Error::other)?;
            app.manage(AppState {
                db: Mutex::new(connection),
                _data_dir: data_dir,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            bootstrap,
            complete_setup,
            list_categories,
            save_category,
            set_category_active,
            reorder_categories,
            save_storage_location,
            set_storage_active,
            list_organization_locations,
            save_organization_location,
            set_organization_location_active,
            delete_storage_location,
            list_found_items,
            create_found_item,
            update_found_item,
            move_found_item,
            return_found_item,
            dispose_found_item,
            matching_candidates,
            review_match,
            adjudicate_match,
            item_activity,
            import_item_photo,
            item_photos,
            remove_item_photo,
            export_backup,
            restore_backup,
            create_lost_report,
            update_lost_report,
            set_lost_report_status,
            list_lost_reports,
            dashboard_stats,
            retention_queue,
            update_organization
        ])
        .run(tauri::generate_context!())
        .expect("error while running Reclaim");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_hours() -> String {
        r#"[{"day":"Monday","closed":false,"opens":"09:00","closes":"17:00","overnight":false},{"day":"Tuesday","closed":false,"opens":"09:00","closes":"17:00","overnight":false},{"day":"Wednesday","closed":false,"opens":"09:00","closes":"17:00","overnight":false},{"day":"Thursday","closed":false,"opens":"09:00","closes":"17:00","overnight":false},{"day":"Friday","closed":false,"opens":"09:00","closes":"17:00","overnight":false},{"day":"Saturday","closed":true,"opens":"09:00","closes":"17:00","overnight":false},{"day":"Sunday","closed":true,"opens":"09:00","closes":"17:00","overnight":false}]"#.into()
    }

    #[test]
    fn photo_bytes_require_supported_mime_and_valid_base64() {
        let data = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/qacAAAAASUVORK5CYII=";
        let (bytes, format) = decode_photo_data_url(data).unwrap();
        assert!(!bytes.is_empty());
        assert_eq!(format, image::ImageFormat::Png);
        assert!(decode_photo_data_url("data:image/svg+xml;base64,PHN2Zy8+").is_err());
        assert!(decode_photo_data_url("data:image/png;base64,not-base64!").is_err());
    }

    #[test]
    fn managed_photo_reads_reject_paths_outside_photo_storage() {
        let root = std::env::temp_dir().join(format!("reclaim-photo-path-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(root.join("photos/item-a")).unwrap();
        std::fs::write(root.join("photos/item-a/photo.jpg"), b"photo").unwrap();
        std::fs::write(root.join("private.txt"), b"private").unwrap();
        assert!(managed_photo_path(&root, "photos/item-a/photo.jpg").is_ok());
        assert!(managed_photo_path(&root, "photos/../../private.txt").is_err());
        assert!(managed_photo_path(&root, "private.txt").is_err());
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn interrupted_restore_recovers_previous_database_and_photos() {
        let root =
            std::env::temp_dir().join(format!("reclaim-restore-recovery-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(root.join("photos")).unwrap();
        std::fs::create_dir_all(root.join("photos.restore-previous")).unwrap();
        std::fs::write(root.join("restore.in-progress"), b"restore").unwrap();
        std::fs::write(root.join("reclaim.sqlite3"), b"partial-new-database").unwrap();
        std::fs::write(
            root.join("reclaim.sqlite3.restore-previous"),
            b"previous-database",
        )
        .unwrap();
        std::fs::write(root.join("photos/new.jpg"), b"partial-new-photo").unwrap();
        std::fs::write(
            root.join("photos.restore-previous/old.jpg"),
            b"previous-photo",
        )
        .unwrap();
        std::fs::create_dir_all(root.join(".restore-stage")).unwrap();

        recover_interrupted_restore(&root).unwrap();

        assert_eq!(
            std::fs::read(root.join("reclaim.sqlite3")).unwrap(),
            b"previous-database"
        );
        assert_eq!(
            std::fs::read(root.join("photos/old.jpg")).unwrap(),
            b"previous-photo"
        );
        assert!(!root.join("restore.in-progress").exists());
        assert!(!root.join(".restore-stage").exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn committed_restore_keeps_new_pair_when_cleanup_was_interrupted() {
        let root = std::env::temp_dir().join(format!("reclaim-restore-commit-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(root.join("photos")).unwrap();
        std::fs::create_dir_all(root.join("photos.restore-previous")).unwrap();
        std::fs::write(root.join("restore.in-progress"), b"committed").unwrap();
        std::fs::write(root.join("reclaim.sqlite3"), b"new-database").unwrap();
        std::fs::write(root.join("reclaim.sqlite3.restore-previous"), b"old-database").unwrap();
        std::fs::write(root.join("photos/new.jpg"), b"new-photo").unwrap();
        std::fs::write(root.join("photos.restore-previous/old.jpg"), b"old-photo").unwrap();

        recover_interrupted_restore(&root).unwrap();

        assert_eq!(std::fs::read(root.join("reclaim.sqlite3")).unwrap(), b"new-database");
        assert_eq!(std::fs::read(root.join("photos/new.jpg")).unwrap(), b"new-photo");
        assert!(!root.join("reclaim.sqlite3.restore-previous").exists());
        assert!(!root.join("photos.restore-previous").exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn interrupted_restore_without_old_photos_removes_partial_new_photos() {
        let root = std::env::temp_dir().join(format!("reclaim-restore-no-photos-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(root.join("photos")).unwrap();
        std::fs::write(root.join("restore.in-progress"), b"pending:photos=0").unwrap();
        std::fs::write(root.join("reclaim.sqlite3"), b"new-database").unwrap();
        std::fs::write(root.join("reclaim.sqlite3.restore-previous"), b"old-database").unwrap();
        std::fs::write(root.join("photos/new.jpg"), b"partial-photo").unwrap();

        recover_interrupted_restore(&root).unwrap();

        assert_eq!(std::fs::read(root.join("reclaim.sqlite3")).unwrap(), b"old-database");
        assert!(!root.join("photos").exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn organization_persists_after_closing_and_reopening_database() {
        let root = std::env::temp_dir().join(format!("reclaim-reopen-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let path = root.join("reclaim.sqlite3");
        let mut conn = db::open_database(&path).unwrap();
        db::create_organization(
            &mut conn,
            SetupInput {
                name: "Library".into(),
                organization_type: "Library".into(),
                phone: "".into(),
                email: "".into(),
                street: "".into(),
                city: "".into(),
                region: "".into(),
                postal_code: "".into(),
                country: "".into(),
                location_name: "Main branch".into(),
                operating_hours: test_hours(),
                locale: "en-US".into(),
                date_format: "MMM d, yyyy".into(),
                retention_days: 30,
                require_verification: true,
                allow_anonymous_finders: true,
                theme: "system".into(),
                primary_color: "#174ea6".into(),
                logo_data_url: Some("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/qacAAAAASUVORK5CYII=".into()),
            },
        )
        .unwrap();
        drop(conn);

        let reopened = db::open_database(&path).unwrap();
        assert_eq!(
            db::organization(&reopened).unwrap().unwrap().name,
            "Library"
        );
        let reopened_org = db::organization(&reopened).unwrap().unwrap();
        assert_eq!(reopened_org.primary_color, "#174ea6");
        assert!(
            reopened_org
                .logo_data_url
                .unwrap()
                .starts_with("data:image/png;base64,")
        );
        assert_eq!(db::storage_locations(&reopened, false).unwrap().len(), 3);
        drop(reopened);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn fresh_database_migrates_and_seeds_idempotently() {
        let conn = db::open_memory().unwrap();
        assert_eq!(db::categories(&conn, false).unwrap().len(), 17);
        let version: i64 = conn
            .pragma_query_value(None, "user_version", |r| r.get(0))
            .unwrap();
        assert_eq!(version, 3);
        db::seed_categories(&conn).unwrap();
        assert_eq!(db::categories(&conn, false).unwrap().len(), 17);
        let fk: i64 = conn
            .pragma_query_value(None, "foreign_keys", |r| r.get(0))
            .unwrap();
        assert_eq!(fk, 1);
    }

    #[test]
    fn migration_from_existing_version_two_preserves_organization_data() {
        let root =
            std::env::temp_dir().join(format!("reclaim-migrate-v2-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let path = root.join("reclaim.sqlite3");
        {
            let conn = Connection::open(&path).unwrap();
            conn.execute_batch(include_str!("../migrations/0001_initial.sql"))
                .unwrap();
            conn.pragma_update(None, "user_version", 1).unwrap();
            conn.execute_batch(include_str!("../migrations/0002_appearance.sql"))
                .unwrap();
            conn.pragma_update(None, "user_version", 2).unwrap();
            conn.execute("INSERT INTO organization(id,name,organization_type,created_at,updated_at) VALUES('legacy','Legacy Library','Library','2025-01-01','2025-01-01')",[]).unwrap();
        }
        let migrated = db::open_database(&path).unwrap();
        let org = db::organization(&migrated).unwrap().unwrap();
        assert_eq!(org.name, "Legacy Library");
        assert_eq!(org.primary_color, "#285c4b");
        assert_eq!(org.logo_data_url, None);
        let version: i64 = migrated
            .pragma_query_value(None, "user_version", |r| r.get(0))
            .unwrap();
        assert_eq!(version, 3);
        drop(migrated);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn brand_colors_require_readable_foreground() {
        assert!(db::valid_brand_color("#285c4b"));
        assert!(db::valid_brand_color("#174ea6"));
        assert!(!db::valid_brand_color("#ffffff"));
        assert!(!db::valid_brand_color("green"));
    }

    #[test]
    fn organization_locations_can_be_added_and_archived_without_losing_primary_location() {
        let mut conn = db::open_memory().unwrap();
        let setup = SetupInput {
            name: "Library".into(),
            organization_type: "Library".into(),
            phone: "".into(),
            email: "".into(),
            street: "".into(),
            city: "".into(),
            region: "".into(),
            postal_code: "".into(),
            country: "".into(),
            location_name: "Main branch".into(),
            operating_hours: test_hours(),
            locale: "en-US".into(),
            date_format: "MMM d, yyyy".into(),
            retention_days: 30,
            require_verification: true,
            allow_anonymous_finders: true,
            theme: "system".into(),
            primary_color: "#285c4b".into(),
            logo_data_url: None,
        };
        db::create_organization(&mut conn, setup).unwrap();
        let annex = db::save_organization_location(
            &mut conn,
            db::OrganizationLocationInput {
                id: None,
                name: "East Annex".into(),
                street: "2 Oak Street".into(),
                city: "Albany".into(),
                region: "NY".into(),
                postal_code: "12207".into(),
                country: "US".into(),
            },
        )
        .unwrap();
        assert_eq!(db::organization_locations(&conn, false).unwrap().len(), 2);
        conn.execute(
            "INSERT INTO storage_locations(id,name,description,organization_location_id,secure,sort_order,created_at) VALUES('east-annex-locker','Locker room cabinet','',?1,0,99,?2)",
            rusqlite::params![annex.id, db::now()],
        )
        .unwrap();
        let linked_storage = db::storage_locations(&conn, true)
            .unwrap()
            .into_iter()
            .find(|location| location.id == "east-annex-locker")
            .unwrap();
        assert_eq!(linked_storage.organization_location_id.as_deref(), Some(annex.id.as_str()));
        assert_eq!(linked_storage.organization_location_name.as_deref(), Some("East Annex"));
        assert!(
            db::save_organization_location(
                &mut conn,
                db::OrganizationLocationInput {
                    id: None,
                    name: "east annex".into(),
                    street: "".into(),
                    city: "".into(),
                    region: "".into(),
                    postal_code: "".into(),
                    country: "".into()
                }
            )
            .is_err()
        );
        db::set_organization_location_active(&conn, &annex.id, false).unwrap();
        let primary = db::organization_locations(&conn, false).unwrap().remove(0);
        assert!(db::set_organization_location_active(&conn, &primary.id, false).is_err());
    }

    #[test]
    fn operating_hours_are_structured_validated_and_support_overnight() {
        let valid = test_hours();
        assert!(db::valid_operating_hours(&valid));
        let invalid = valid.replace("\"closes\":\"17:00\"", "\"closes\":\"08:00\"");
        assert!(!db::valid_operating_hours(&invalid));
        let overnight = valid
            .replacen("\"closes\":\"17:00\"", "\"closes\":\"08:00\"", 1)
            .replacen("\"overnight\":false", "\"overnight\":true", 1);
        assert!(db::valid_operating_hours(&overnight));
    }

    #[test]
    fn lost_report_can_be_edited_closed_and_reopened_with_history() {
        let mut conn = db::open_memory().unwrap();
        let setup = SetupInput {
            name: "Library".into(),
            organization_type: "Library".into(),
            phone: "".into(),
            email: "".into(),
            street: "".into(),
            city: "".into(),
            region: "".into(),
            postal_code: "".into(),
            country: "".into(),
            location_name: "Main branch".into(),
            operating_hours: test_hours(),
            locale: "en-US".into(),
            date_format: "MMM d, yyyy".into(),
            retention_days: 30,
            require_verification: true,
            allow_anonymous_finders: true,
            theme: "system".into(),
            primary_color: "#285c4b".into(),
            logo_data_url: None,
        };
        db::create_organization(&mut conn, setup).unwrap();
        let original = db::create_lost(
            &mut conn,
            LostInput {
                name: "Blue bottle".into(),
                category_id: "drinkware".into(),
                description: "Steel".into(),
                color: "Blue".into(),
                brand: "".into(),
                lost_at: "2026-10-31T10:00".into(),
                last_location: "Gym".into(),
                claimant_name: "Alex".into(),
                contact: "".into(),
                notes: "".into(),
            },
        )
        .unwrap();
        let edited = db::update_lost(
            &mut conn,
            &original.id,
            LostInput {
                name: "Insulated bottle".into(),
                category_id: "drinkware".into(),
                description: "Steel, sticker".into(),
                color: "Blue".into(),
                brand: "Northstar".into(),
                lost_at: "2026-10-31T11:00".into(),
                last_location: "East gym".into(),
                claimant_name: "Alex".into(),
                contact: "".into(),
                notes: "Checked front desk".into(),
            },
        )
        .unwrap();
        assert_eq!(edited.name, "Insulated bottle");
        db::set_lost_status(&mut conn, &original.id, "closed").unwrap();
        assert!(
            db::update_lost(
                &mut conn,
                &original.id,
                LostInput {
                    name: "Nope".into(),
                    category_id: "drinkware".into(),
                    description: "".into(),
                    color: "".into(),
                    brand: "".into(),
                    lost_at: "2026-10-31T11:00".into(),
                    last_location: "".into(),
                    claimant_name: "Alex".into(),
                    contact: "".into(),
                    notes: "".into(),
                }
            )
            .is_ok()
        );
        db::set_lost_status(&mut conn, &original.id, "open").unwrap();
        let status: String = conn
            .query_row(
                "SELECT status FROM lost_reports WHERE id=?1",
                [&original.id],
                |r| r.get(0),
            )
            .unwrap();
        let events: i64 = conn.query_row("SELECT count(*) FROM custody_events WHERE record_type='lost_report' AND record_id=?1", [&original.id], |r|r.get(0)).unwrap();
        assert_eq!(status, "open");
        assert!(events >= 4);
    }

    #[test]
    fn setup_is_single_use_and_creates_multiple_storage_areas() {
        let mut conn = db::open_memory().unwrap();
        let input = SetupInput {
            name: "Northside Center".into(),
            organization_type: "Community center".into(),
            phone: "".into(),
            email: "".into(),
            street: "1 Main".into(),
            city: "Albany".into(),
            region: "NY".into(),
            postal_code: "12207".into(),
            country: "US".into(),
            location_name: "Main Building".into(),
            operating_hours: test_hours(),
            locale: "en-US".into(),
            date_format: "MMM d, yyyy".into(),
            retention_days: 30,
            require_verification: true,
            allow_anonymous_finders: true,
            theme: "system".into(),
            primary_color: "#285c4b".into(),
            logo_data_url: None,
        };
        assert!(db::create_organization(&mut conn, input.clone()).is_ok());
        assert_eq!(db::storage_locations(&conn, false).unwrap().len(), 3);
        assert!(db::create_organization(&mut conn, input).is_err());
    }

    #[test]
    fn invalid_records_and_missing_foreign_keys_are_rejected() {
        let mut conn = db::open_memory().unwrap();
        assert!(
            db::create_found(
                &mut conn,
                FoundInput {
                    name: " ".into(),
                    category_id: "other".into(),
                    description: "".into(),
                    color: "".into(),
                    brand: "".into(),
                    found_at: db::now(),
                    found_location: "".into(),
                    storage_location_id: "x".into(),
                    finder_name: "".into(),
                    finder_contact: "".into(),
                    staff_notes: "".into()
                }
            )
            .is_err()
        );
        assert!(conn.execute("INSERT INTO found_items(id,reference,name,category_id,found_at,storage_location_id,created_at,updated_at) VALUES('x','x','Test','missing','now','missing','now','now')",[]).is_err());
    }

    fn configured_database(retention_days: i64) -> (Connection, String, String) {
        let mut conn = db::open_memory().unwrap();
        let input = SetupInput {
            name: "Northside Center".into(),
            organization_type: "Community center".into(),
            phone: "".into(),
            email: "".into(),
            street: "".into(),
            city: "".into(),
            region: "".into(),
            postal_code: "".into(),
            country: "US".into(),
            location_name: "Main Building".into(),
            operating_hours: test_hours(),
            locale: "en-US".into(),
            date_format: "MMM d, yyyy".into(),
            retention_days,
            require_verification: true,
            allow_anonymous_finders: true,
            theme: "system".into(),
            primary_color: "#285c4b".into(),
            logo_data_url: None,
        };
        db::create_organization(&mut conn, input).unwrap();
        let locations = db::storage_locations(&conn, false).unwrap();
        let general = locations.iter().find(|l| !l.secure).unwrap().id.clone();
        let secure = locations.iter().find(|l| l.secure).unwrap().id.clone();
        (conn, general, secure)
    }

    #[test]
    fn matching_is_ranked_reviewable_and_never_returns_an_item() {
        let (mut conn, storage, _) = configured_database(30);
        let found = db::create_found(
            &mut conn,
            FoundInput {
                name: "Blue Nike backpack".into(),
                category_id: "bags-backpacks".into(),
                description: "Small backpack with a red zipper".into(),
                color: "Blue".into(),
                brand: "Nike".into(),
                found_at: "2026-10-30T10:00".into(),
                found_location: "Gym lobby".into(),
                storage_location_id: storage,
                finder_name: "".into(),
                finder_contact: "".into(),
                staff_notes: "".into(),
            },
        )
        .unwrap();
        let report = db::create_lost(
            &mut conn,
            LostInput {
                name: "Blue backpack".into(),
                category_id: "bags-backpacks".into(),
                description: "Nike bag with red zipper".into(),
                color: "Blue".into(),
                brand: "Nike".into(),
                lost_at: "2026-10-30T12:00".into(),
                last_location: "Gym lobby".into(),
                claimant_name: "Alex Smith".into(),
                contact: "".into(),
                notes: "".into(),
            },
        )
        .unwrap();
        let first = db::match_candidates(&mut conn, &report.id).unwrap();
        let second = db::match_candidates(&mut conn, &report.id).unwrap();
        assert_eq!(first[0].score, second[0].score);
        assert!(first[0].score >= 70);
        assert_eq!(first[0].found_item.status, "in_custody");
        db::review_match(&mut conn, &report.id, &found.id, "dismissed").unwrap();
        assert_eq!(
            db::match_candidates(&mut conn, &report.id).unwrap()[0].review_status,
            "dismissed"
        );
        db::review_match(&mut conn, &report.id, &found.id, "suggested").unwrap();
        let candidate = db::match_candidates(&mut conn, &report.id)
            .unwrap()
            .remove(0);
        assert_eq!(candidate.review_status, "suggested");
        assert_eq!(candidate.found_item.status, "in_custody");
        let competing = db::create_lost(
            &mut conn,
            LostInput {
                name: "Blue backpack".into(),
                category_id: "bags-backpacks".into(),
                description: "Same backpack".into(),
                color: "Blue".into(),
                brand: "Nike".into(),
                lost_at: "2026-10-30T12:00".into(),
                last_location: "Gym lobby".into(),
                claimant_name: "Jordan Lee".into(),
                contact: "".into(),
                notes: "".into(),
            },
        )
        .unwrap();
        db::review_match(&mut conn, &report.id, &found.id, "confirmed").unwrap();
        assert!(db::review_match(&mut conn, &competing.id, &found.id, "confirmed").is_err());
        let candidates = db::match_candidates(&mut conn, &competing.id).unwrap();
        let competing_candidate = candidates.iter().find(|c| c.found_item.id == found.id).unwrap();
        assert!(competing_candidate.competing_claims.iter().any(|c| c.report_id == report.id && c.claimant_name == "Alex Smith"));
        db::adjudicate_match(&mut conn, &competing.id, &found.id).unwrap();
        let reviews: Vec<(String,String)> = {
            let mut statement=conn.prepare("SELECT lost_report_id,status FROM match_reviews WHERE found_item_id=?1 ORDER BY lost_report_id").unwrap();
            statement.query_map([&found.id],|r|Ok((r.get(0)?,r.get(1)?))).unwrap().collect::<Result<Vec<_>,_>>().unwrap()
        };
        assert_eq!(reviews.iter().find(|(id,_)| id==&report.id).unwrap().1,"dismissed");
        assert_eq!(reviews.iter().find(|(id,_)| id==&competing.id).unwrap().1,"confirmed");
        let conflicting_return = db::ReturnInput {
            found_item_id: found.id.clone(),
            lost_report_id: Some(report.id.clone()),
            recipient_name: "Alex Smith".into(),
            verification_method: "description_confirmed".into(),
            verification_note: "Identified red zipper".into(),
            staff_note: "".into(),
        };
        assert!(db::return_found(&mut conn, conflicting_return, false, "").is_err());
    }

    #[test]
    fn secure_return_requires_evidence_and_duplicate_return_is_rejected() {
        let (mut conn, _, secure) = configured_database(30);
        let item = db::create_found(
            &mut conn,
            FoundInput {
                name: "Silver phone".into(),
                category_id: "phones-mobile".into(),
                description: "".into(),
                color: "Silver".into(),
                brand: "".into(),
                found_at: db::now(),
                found_location: "Front desk".into(),
                storage_location_id: secure,
                finder_name: "".into(),
                finder_contact: "".into(),
                staff_notes: "".into(),
            },
        )
        .unwrap();
        let invalid = db::ReturnInput {
            found_item_id: item.id.clone(),
            lost_report_id: None,
            recipient_name: "Alex".into(),
            verification_method: "none".into(),
            verification_note: "".into(),
            staff_note: "".into(),
        };
        assert!(db::return_found(&mut conn, invalid, false, "").is_err());
        let valid = db::ReturnInput {
            found_item_id: item.id.clone(),
            lost_report_id: None,
            recipient_name: "Alex".into(),
            verification_method: "description_confirmed".into(),
            verification_note: "Described sticker under case".into(),
            staff_note: "".into(),
        };
        db::return_found(&mut conn, valid.clone(), false, "").unwrap();
        assert!(db::return_found(&mut conn, valid, false, "").is_err());
        let count:i64=conn.query_row("SELECT count(*) FROM custody_events WHERE record_id=?1 AND event_type='item_returned'",[&item.id],|r|r.get(0)).unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn disposition_is_explicit_and_only_allowed_after_retention_deadline() {
        let (mut conn, storage, _) = configured_database(30);
        let recent = db::create_found(
            &mut conn,
            FoundInput {
                name: "New keys".into(),
                category_id: "keys-keychains".into(),
                description: "".into(),
                color: "".into(),
                brand: "".into(),
                found_at: db::now(),
                found_location: "".into(),
                storage_location_id: storage.clone(),
                finder_name: "".into(),
                finder_contact: "".into(),
                staff_notes: "".into(),
            },
        )
        .unwrap();
        assert!(db::dispose_found(&mut conn, &recent.id, "recycled", "").is_err());
        let old_date = (chrono::Utc::now() - chrono::Duration::days(60)).to_rfc3339();
        conn.execute(
            "UPDATE found_items SET found_at=?1 WHERE id=?2",
            params![old_date, recent.id],
        )
        .unwrap();
        db::dispose_found(&mut conn, &recent.id, "recycled", "").unwrap();
        assert!(db::dispose_found(&mut conn, &recent.id, "recycled", "").is_err());
    }
}
