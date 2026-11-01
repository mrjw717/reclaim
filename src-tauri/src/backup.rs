use rusqlite::{Connection, backup::Backup};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    fs::{self, File},
    io::{Read, Write},
    path::{Component, Path, PathBuf},
    time::Duration,
};
use uuid::Uuid;
use zip::{ZipArchive, ZipWriter, write::SimpleFileOptions};

const ARCHIVE_VERSION: u32 = 1;
const MAX_ARCHIVE_BYTES: u64 = 2 * 1024 * 1024 * 1024;
const MAX_MANIFEST_BYTES: u64 = 1024 * 1024;
const MAX_BACKUP_FILES: usize = 100_000;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    pub format_version: u32,
    pub schema_version: u32,
    pub created_at: String,
    pub files: Vec<FileDigest>,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDigest {
    pub path: String,
    pub sha256: String,
    pub size: u64,
}

fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn collect_files(root: &Path, current: &Path, result: &mut Vec<PathBuf>) -> Result<(), String> {
    for entry in fs::read_dir(current).map_err(|e| format!("Could not read photo storage: {e}"))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let metadata = fs::symlink_metadata(&path).map_err(|e| e.to_string())?;
        if metadata.file_type().is_symlink() {
            return Err("Backup cannot include linked files in photo storage.".into());
        }
        if metadata.is_dir() {
            collect_files(root, &path, result)?
        } else if metadata.is_file() {
            result.push(
                path.strip_prefix(root)
                    .map_err(|e| e.to_string())?
                    .to_path_buf(),
            )
        }
    }
    Ok(())
}

pub fn create(
    connection: &Connection,
    data_dir: &Path,
    destination: &Path,
) -> Result<Manifest, String> {
    let parent = destination
        .parent()
        .ok_or_else(|| "Choose a backup file destination.".to_string())?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let scratch = data_dir.join(format!(".backup-{}", Uuid::new_v4()));
    fs::create_dir_all(&scratch).map_err(|e| e.to_string())?;
    let database = scratch.join("database.sqlite3");
    let result = (|| {
        let mut snapshot = Connection::open(&database).map_err(|e| e.to_string())?;
        let backup = Backup::new(connection, &mut snapshot).map_err(|e| e.to_string())?;
        backup
            .run_to_completion(128, Duration::from_millis(10), None)
            .map_err(|e| e.to_string())?;
        drop(backup);
        drop(snapshot);
        let mut paths = vec![PathBuf::from("database.sqlite3")];
        let photos = data_dir.join("photos");
        if photos.exists() {
            collect_files(data_dir, &photos, &mut paths)?
        }
        let mut entries = Vec::new();
        for relative in &paths {
            let bytes = fs::read(if relative == Path::new("database.sqlite3") {
                database.clone()
            } else {
                data_dir.join(relative)
            })
            .map_err(|e| e.to_string())?;
            entries.push(FileDigest {
                path: relative.to_string_lossy().replace('\\', "/"),
                sha256: digest(&bytes),
                size: bytes.len() as u64,
            });
        }
        let schema_version: u32 = Connection::open(&database)
            .map_err(|e| e.to_string())?
            .pragma_query_value(None, "user_version", |r| r.get::<_, u32>(0))
            .map_err(|e| e.to_string())?;
        let manifest = Manifest {
            format_version: ARCHIVE_VERSION,
            schema_version,
            created_at: chrono::Utc::now().to_rfc3339(),
            files: entries,
        };
        let temp = parent.join(format!(".reclaim-{}.tmp", Uuid::new_v4()));
        let file = File::create(&temp).map_err(|e| e.to_string())?;
        let mut archive = ZipWriter::new(file);
        let options =
            SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
        for entry in &manifest.files {
            let disk = if entry.path == "database.sqlite3" {
                database.clone()
            } else {
                data_dir.join(&entry.path)
            };
            archive
                .start_file(&entry.path, options)
                .map_err(|e| e.to_string())?;
            let mut input = File::open(disk).map_err(|e| e.to_string())?;
            std::io::copy(&mut input, &mut archive).map_err(|e| e.to_string())?;
        }
        archive
            .start_file("manifest.json", options)
            .map_err(|e| e.to_string())?;
        archive
            .write_all(&serde_json::to_vec_pretty(&manifest).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
        let file = archive.finish().map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
        inspect(&temp, None)?;
        if destination.exists() {
            let _ = fs::remove_file(&temp);
            return Err(
                "A file already exists at that destination. Choose a new backup filename.".into(),
            );
        }
        fs::rename(&temp, destination).map_err(|e| format!("Could not finish backup: {e}"))?;
        Ok(manifest)
    })();
    let _ = fs::remove_dir_all(scratch);
    result
}

fn safe_relative(value: &str) -> Result<PathBuf, String> {
    let path = Path::new(value);
    if value.contains('\\')
        || value.starts_with('/')
        || value.split('/').any(|part| part.is_empty() || part == "." || part == "..")
        || value.split('/').next().is_some_and(|part| part.contains(':'))
        || path.is_absolute()
        || path
            .components()
            .any(|c| !matches!(c, Component::Normal(_)))
    {
        return Err("Backup contains an unsafe file path.".into());
    }
    Ok(path.to_path_buf())
}

fn inspect(path: &Path, destination: Option<&Path>) -> Result<Manifest, String> {
    let metadata = fs::metadata(path).map_err(|e| format!("Could not open backup: {e}"))?;
    if metadata.len() > MAX_ARCHIVE_BYTES {
        return Err("Backup exceeds the 2 GB safety limit.".into());
    }
    let file = File::open(path).map_err(|e| e.to_string())?;
    let mut archive =
        ZipArchive::new(file).map_err(|_| "Backup archive is damaged or invalid.".to_string())?;
    let mut manifest_reader = archive
        .by_name("manifest.json")
        .map_err(|_| "Backup manifest is missing.".to_string())?;
    if manifest_reader.size() > MAX_MANIFEST_BYTES {
        return Err("Backup manifest exceeds the 1 MB safety limit.".into());
    }
    let mut json = String::new();
    manifest_reader
        .read_to_string(&mut json)
        .map_err(|e| e.to_string())?;
    drop(manifest_reader);
    let manifest: Manifest =
        serde_json::from_str(&json).map_err(|_| "Backup manifest is invalid.".to_string())?;
    if manifest.format_version != ARCHIVE_VERSION || manifest.schema_version > 3 {
        return Err("This backup format is not compatible with this Reclaim version.".into());
    }
    if manifest.files.is_empty() || manifest.files.len() > MAX_BACKUP_FILES {
        return Err("Backup contains an unsupported number of files.".into());
    }
    let mut expected = HashSet::new();
    let mut total = 0u64;
    for entry in &manifest.files {
        let relative = safe_relative(&entry.path)?;
        if entry.path == "manifest.json" || !expected.insert(entry.path.clone()) {
            return Err("Backup manifest contains duplicate or reserved file paths.".into());
        }
        if entry.path != "database.sqlite3" && !entry.path.starts_with("photos/") {
            return Err("Backup contains an unexpected file.".into());
        }
        let mut file = archive
            .by_name(&entry.path)
            .map_err(|_| format!("Backup file is missing: {}", entry.path))?;
        if file.size() != entry.size {
            return Err(format!("Backup size check failed for {}.", entry.path));
        }
        total = total.saturating_add(file.size());
        if total > MAX_ARCHIVE_BYTES {
            return Err("Backup contents exceed the 2 GB safety limit.".into());
        }
        let output_path = if let Some(destination) = destination {
            let output_path = destination.join(&relative);
            if let Some(parent) = output_path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            Some(File::options().write(true).create_new(true).open(&output_path).map_err(|e| e.to_string())?)
        } else {
            None
        };
        let mut hasher = Sha256::new();
        let mut copied = 0u64;
        let mut buffer = [0u8; 64 * 1024];
        let mut output = output_path;
        loop {
            let count = file.read(&mut buffer).map_err(|e| e.to_string())?;
            if count == 0 { break; }
            copied = copied.saturating_add(count as u64);
            if copied > entry.size { return Err("Backup file exceeded its declared size.".into()); }
            hasher.update(&buffer[..count]);
            if let Some(writer) = output.as_mut() {
                writer.write_all(&buffer[..count]).map_err(|e| e.to_string())?;
            }
        }
        if copied != entry.size || format!("{:x}", hasher.finalize()) != entry.sha256 {
            return Err(format!("Backup integrity check failed for {}.", entry.path));
        }
    }
    if !expected.contains("database.sqlite3") {
        return Err("Backup database is missing.".into());
    }
    if archive.len() != manifest.files.len() + 1 {
        return Err("Backup contains files that are not listed in its manifest.".into());
    }
    Ok(manifest)
}

pub fn stage_restore(path: &Path, data_dir: &Path) -> Result<PathBuf, String> {
    let stage = data_dir.join(format!(".restore-{}", Uuid::new_v4()));
    fs::create_dir_all(&stage).map_err(|e| e.to_string())?;
    let result = (|| {
        inspect(path, Some(&stage))?;
        let database = Connection::open(stage.join("database.sqlite3"))
            .map_err(|e| format!("Backup database could not be opened: {e}"))?;
        let integrity: String = database
            .query_row("PRAGMA integrity_check", [], |r| r.get(0))
            .map_err(|e| e.to_string())?;
        if integrity != "ok" {
            return Err(format!(
                "Backup database integrity check failed: {integrity}"
            ));
        }
        let foreign_errors: i64 = database
            .query_row("SELECT count(*) FROM pragma_foreign_key_check", [], |r| {
                r.get(0)
            })
            .map_err(|e| e.to_string())?;
        if foreign_errors > 0 {
            return Err("Backup has broken database relationships.".into());
        }
        let version: u32 = database
            .pragma_query_value(None, "user_version", |r| r.get(0))
            .map_err(|e| e.to_string())?;
        if version > 3 {
            return Err("Backup database requires a newer Reclaim version.".into());
        }
        Ok(())
    })();
    if let Err(error) = result {
        let _ = fs::remove_dir_all(&stage);
        return Err(error);
    }
    Ok(stage)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    fn temp_dir() -> PathBuf {
        let path = std::env::temp_dir().join(format!("reclaim-backup-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn backup_paths_reject_unix_and_windows_traversal() {
        assert!(safe_relative("photos/item-a/photo.jpg").is_ok());
        for path in [
            "../secret",
            "photos/../secret",
            "/etc/passwd",
            "C:/private/file",
            r"photos\..\secret",
            "photos//photo.jpg",
        ] {
            assert!(safe_relative(path).is_err(), "accepted unsafe path: {path}");
        }
    }

    #[test]
    fn verified_backup_contains_a_consistent_database_and_photos() {
        let root = temp_dir();
        let data = root.join("app-data");
        fs::create_dir_all(data.join("photos/item-a")).unwrap();
        fs::write(data.join("photos/item-a/photo.jpg"), b"test-photo-bytes").unwrap();
        let connection = db::open_database(&data.join("reclaim.sqlite3")).unwrap();
        let destination = root.join("workspace.reclaim.zip");
        let manifest = create(&connection, &data, &destination).unwrap();
        assert_eq!(manifest.format_version, 1);
        assert_eq!(manifest.schema_version, 3);
        assert_eq!(manifest.files.len(), 2);
        let stage = stage_restore(&destination, &data).unwrap();
        assert!(stage.join("database.sqlite3").exists());
        assert_eq!(
            fs::read(stage.join("photos/item-a/photo.jpg")).unwrap(),
            b"test-photo-bytes"
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn invalid_and_corrupted_archives_are_rejected_without_staging() {
        let root = temp_dir();
        let data = root.join("app-data");
        fs::create_dir_all(&data).unwrap();
        let connection = db::open_database(&data.join("reclaim.sqlite3")).unwrap();
        let destination = root.join("valid.reclaim.zip");
        create(&connection, &data, &destination).unwrap();
        let mut bytes = fs::read(&destination).unwrap();
        let offset = bytes.len() / 2;
        bytes[offset] ^= 0xff;
        let corrupt = root.join("corrupt.reclaim.zip");
        fs::write(&corrupt, bytes).unwrap();
        assert!(stage_restore(&corrupt, &data).is_err());
        assert!(fs::read_dir(&data).unwrap().all(|e| {
            !e.unwrap()
                .file_name()
                .to_string_lossy()
                .starts_with(".restore-")
        }));
        let invalid = root.join("invalid.zip");
        fs::write(&invalid, b"not a zip archive").unwrap();
        assert!(stage_restore(&invalid, &data).is_err());
        let _ = fs::remove_dir_all(root);
    }
}
