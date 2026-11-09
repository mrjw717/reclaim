use chrono::{Local, NaiveTime, Utc};
use rusqlite::{Connection, OptionalExtension, params, params_from_iter};
use serde::{Deserialize, Serialize};
use std::{path::Path, time::Duration};
use uuid::Uuid;

const INITIAL_SCHEMA: &str = include_str!("../migrations/0001_initial.sql");

pub const CATEGORIES: [(&str, &str, &str); 17] = [
    ("phones-mobile", "Phones & Mobile Devices", "Smartphone"),
    ("computers-tablets", "Computers & Tablets", "Laptop"),
    ("keys-keychains", "Keys & Keychains", "KeyRound"),
    ("wallets-purses", "Wallets & Purses", "Wallet"),
    ("clothing", "Clothing", "Shirt"),
    ("shoes-footwear", "Shoes & Footwear", "Footprints"),
    ("bags-backpacks", "Bags & Backpacks", "Backpack"),
    ("jewelry-watches", "Jewelry & Watches", "Watch"),
    ("glasses-eyewear", "Glasses & Eyewear", "Glasses"),
    ("drinkware", "Water Bottles & Drinkware", "CupSoda"),
    ("books-school", "Books & School Supplies", "BookOpen"),
    ("sporting-equipment", "Sporting Equipment", "Trophy"),
    ("toys-games", "Toys & Games", "Gamepad2"),
    (
        "headphones-audio",
        "Headphones & Audio Devices",
        "Headphones",
    ),
    (
        "identification-documents",
        "Identification & Documents",
        "IdCard",
    ),
    ("personal-accessories", "Personal Accessories", "Watch"),
    ("other", "Other / Uncategorized", "Package"),
];

pub fn open_database(path: &Path) -> Result<Connection, String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Could not create data folder: {e}"))?;
    }
    let mut conn = Connection::open(path).map_err(db_error)?;
    configure(&conn)?;
    migrate(&mut conn)?;
    seed_categories(&conn)?;
    Ok(conn)
}

#[cfg(test)]
pub fn open_memory() -> Result<Connection, String> {
    let mut conn = Connection::open_in_memory().map_err(db_error)?;
    configure(&conn)?;
    migrate(&mut conn)?;
    seed_categories(&conn)?;
    Ok(conn)
}

fn configure(conn: &Connection) -> Result<(), String> {
    conn.busy_timeout(Duration::from_secs(5))
        .map_err(db_error)?;
    conn.pragma_update(None, "foreign_keys", "ON")
        .map_err(db_error)?;
    conn.pragma_update(None, "journal_mode", "WAL")
        .map_err(db_error)?;
    conn.pragma_update(None, "synchronous", "NORMAL")
        .map_err(db_error)?;
    conn.pragma_update(None, "secure_delete", "ON")
        .map_err(db_error)?;
    Ok(())
}

fn migrate(conn: &mut Connection) -> Result<(), String> {
    let version: i64 = conn
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .map_err(db_error)?;
    if version > 4 {
        return Err(format!(
            "Database version {version} is newer than this Reclaim release."
        ));
    }
    if version == 0 {
        let tx = conn.transaction().map_err(db_error)?;
        tx.execute_batch(INITIAL_SCHEMA).map_err(db_error)?;
        tx.pragma_update(None, "user_version", 1)
            .map_err(db_error)?;
        tx.commit().map_err(db_error)?;
    }
    let current: i64 = conn
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .map_err(db_error)?;
    if current == 1 {
        let tx = conn.transaction().map_err(db_error)?;
        tx.execute_batch(include_str!("../migrations/0002_appearance.sql"))
            .map_err(db_error)?;
        tx.pragma_update(None, "user_version", 2)
            .map_err(db_error)?;
        tx.commit().map_err(db_error)?;
    }
    let current: i64 = conn
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .map_err(db_error)?;
    if current == 2 {
        let tx = conn.transaction().map_err(db_error)?;
        tx.execute_batch(include_str!("../migrations/0003_branding.sql"))
            .map_err(db_error)?;
        tx.pragma_update(None, "user_version", 3)
            .map_err(db_error)?;
        tx.commit().map_err(db_error)?;
    }
    let current: i64 = conn
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .map_err(db_error)?;
    if current == 3 {
        let tx = conn.transaction().map_err(db_error)?;
        tx.execute_batch(include_str!("../migrations/0004_claim_integrity.sql"))
            .map_err(db_error)?;
        tx.pragma_update(None, "user_version", 4)
            .map_err(db_error)?;
        tx.commit().map_err(db_error)?;
    }
    Ok(())
}

pub fn seed_categories(conn: &Connection) -> Result<(), String> {
    let now = now();
    let tx = conn.unchecked_transaction().map_err(db_error)?;
    for (order, (id, name, icon)) in CATEGORIES.iter().enumerate() {
        tx.execute(
            "INSERT INTO categories(id,name,description,icon,active,sort_order,created_at,updated_at) VALUES(?1,?2,'',?3,1,?4,?5,?5) ON CONFLICT(id) DO NOTHING",
            params![id, name, icon, order as i64, now],
        ).map_err(db_error)?;
    }
    tx.commit().map_err(db_error)
}

pub fn now() -> String {
    Utc::now().to_rfc3339()
}
pub fn valid_brand_color(value: &str) -> bool {
    let Some(hex) = value.strip_prefix('#') else {
        return false;
    };
    if hex.len() != 6 {
        return false;
    }
    let Ok(rgb) = u32::from_str_radix(hex, 16) else {
        return false;
    };
    let channel = |shift: u32| {
        let v = ((rgb >> shift) & 255) as f64 / 255.0;
        if v <= 0.04045 {
            v / 12.92
        } else {
            ((v + 0.055) / 1.055).powf(2.4)
        }
    };
    let luminance = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
    1.05 / (luminance + 0.05) >= 4.5
}
#[derive(Deserialize)]
struct OperatingDay {
    day: String,
    closed: bool,
    opens: String,
    closes: String,
    overnight: bool,
}
pub fn valid_operating_hours(value: &str) -> bool {
    const DAYS: [&str; 7] = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
    ];
    let Ok(days) = serde_json::from_str::<Vec<OperatingDay>>(value) else {
        return false;
    };
    days.len() == 7
        && days.iter().zip(DAYS).all(|(d, expected)| {
            if d.day != expected {
                return false;
            }
            if d.closed {
                return true;
            }
            let (Ok(open), Ok(close)) = (
                NaiveTime::parse_from_str(&d.opens, "%H:%M"),
                NaiveTime::parse_from_str(&d.closes, "%H:%M"),
            ) else {
                return false;
            };
            // An open day is the interval [opens, closes) on that weekday, or
            // [opens, closes) ending on the next calendar day when `overnight`
            // is set. Equal times are rejected in both modes: "09:00 to 09:00"
            // cannot distinguish a zero-length day from a 24-hour day, and
            // Reclaim never stores an ambiguous schedule. 24-hour service is
            // recorded as 00:00 to 23:59.
            if d.overnight {
                close < open
            } else {
                close > open
            }
        })
}
pub fn current_staff_name(conn: &Connection) -> Result<String, String> {
    conn.query_row("SELECT staff_name FROM organization LIMIT 1", [], |r| {
        r.get::<_, String>(0)
    })
    .optional()
    .map_err(db_error)?
    .ok_or_else(|| "Organization has not been set up yet.".into())
}
fn valid_logo_data_url(value: &str) -> bool {
    value.len() <= 3_000_000
        && [
            "data:image/png;base64,",
            "data:image/jpeg;base64,",
            "data:image/webp;base64,",
        ]
        .iter()
        .any(|prefix| value.starts_with(prefix))
}

#[cfg(test)]
mod organization_location_tests {
    use super::*;

    #[test]
    fn editing_archived_site_does_not_restore_it() {
        let mut conn = open_memory().expect("in-memory database");
        let id = "site-1";
        conn.execute(
            "INSERT INTO organization_locations(id,name,street,city,region,postal_code,country,active,created_at) VALUES(?1,'North Annex','','','','','','0',?2)",
            params![id, now()],
        ).expect("site seeded");
        save_organization_location(
            &mut conn,
            OrganizationLocationInput {
                id: Some(id.into()),
                name: "North Annex Renovated".into(),
                street: "1 Main".into(),
                city: "Sampletown".into(),
                region: String::new(),
                postal_code: String::new(),
                country: String::new(),
            },
        )
        .expect("site updated");
        let active: i64 = conn
            .query_row(
                "SELECT active FROM organization_locations WHERE id=?1",
                [id],
                |r| r.get(0),
            )
            .expect("active field");
        assert_eq!(active, 0, "editing a site must not implicitly restore it");
    }
}
pub fn new_id() -> String {
    Uuid::new_v4().to_string()
}
pub fn new_reference(prefix: &str) -> String {
    let value = Uuid::new_v4().simple().to_string();
    format!(
        "{prefix}-{}-{}",
        Local::now().format("%y%m"),
        value[..8].to_uppercase()
    )
}
pub fn db_error(error: rusqlite::Error) -> String {
    format!("Database operation failed: {error}")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub active: bool,
    pub sort_order: i64,
    pub retention_days: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageLocation {
    pub id: String,
    pub name: String,
    pub description: String,
    pub parent_id: Option<String>,
    pub parent_name: Option<String>,
    pub organization_location_id: Option<String>,
    pub organization_location_name: Option<String>,
    pub secure: bool,
    pub active: bool,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationLocation {
    pub id: String,
    pub name: String,
    pub street: String,
    pub city: String,
    pub region: String,
    pub postal_code: String,
    pub country: String,
    pub active: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationLocationInput {
    pub id: Option<String>,
    pub name: String,
    pub street: String,
    pub city: String,
    pub region: String,
    pub postal_code: String,
    pub country: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Organization {
    pub id: String,
    pub name: String,
    pub organization_type: String,
    pub phone: String,
    pub email: String,
    pub street: String,
    pub city: String,
    pub region: String,
    pub postal_code: String,
    pub country: String,
    pub operating_hours: String,
    pub locale: String,
    pub date_format: String,
    pub retention_days: i64,
    pub require_verification: bool,
    pub allow_anonymous_finders: bool,
    pub theme: String,
    pub primary_color: String,
    pub logo_data_url: Option<String>,
    pub legacy_operating_hours: Option<String>,
    pub staff_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupInput {
    pub name: String,
    pub organization_type: String,
    pub phone: String,
    pub email: String,
    pub street: String,
    pub city: String,
    pub region: String,
    pub postal_code: String,
    pub country: String,
    pub location_name: String,
    pub operating_hours: String,
    pub locale: String,
    pub date_format: String,
    pub retention_days: i64,
    pub require_verification: bool,
    pub allow_anonymous_finders: bool,
    pub theme: String,
    pub primary_color: String,
    pub logo_data_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FoundItem {
    pub id: String,
    pub reference: String,
    pub name: String,
    pub category_id: String,
    pub category_name: String,
    pub description: String,
    pub color: String,
    pub brand: String,
    pub found_at: String,
    pub found_location: String,
    pub storage_location_id: String,
    pub storage_location: String,
    pub storage_secure: bool,
    pub finder_name: String,
    pub finder_contact: String,
    pub staff_notes: String,
    pub status: String,
    pub retention_days: Option<i64>,
    pub returned_at: Option<String>,
    pub disposed_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FoundInput {
    pub name: String,
    pub category_id: String,
    pub description: String,
    pub color: String,
    pub brand: String,
    pub found_at: String,
    pub found_location: String,
    pub storage_location_id: String,
    pub finder_name: String,
    pub finder_contact: String,
    pub staff_notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LostReport {
    pub id: String,
    pub reference: String,
    pub name: String,
    pub category_id: String,
    pub category_name: String,
    pub description: String,
    pub color: String,
    pub brand: String,
    pub lost_at: String,
    pub last_location: String,
    pub claimant_name: String,
    pub contact: String,
    pub notes: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LostInput {
    pub name: String,
    pub category_id: String,
    pub description: String,
    pub color: String,
    pub brand: String,
    pub lost_at: String,
    pub last_location: String,
    pub claimant_name: String,
    pub contact: String,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchCandidate {
    pub found_item: FoundItem,
    pub score: i64,
    pub explanation: Vec<String>,
    pub review_status: String,
    pub competing_claims: Vec<CompetingClaim>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompetingClaim {
    pub report_id: String,
    pub reference: String,
    pub claimant_name: String,
    pub item_name: String,
    pub status: String,
    pub score: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfirmedClaim {
    pub lost_report_id: String,
    pub reference: String,
    pub claimant_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReturnInput {
    pub found_item_id: String,
    pub lost_report_id: Option<String>,
    pub recipient_name: String,
    pub verification_method: String,
    pub verification_note: String,
    pub staff_note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityEvent {
    pub id: String,
    pub record_type: String,
    pub record_id: String,
    pub event_type: String,
    pub happened_at: String,
    pub staff_name: String,
    pub details: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhotoRecord {
    pub id: String,
    pub relative_path: String,
    pub thumbnail_path: Option<String>,
    pub mime_type: String,
    pub byte_size: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryPage {
    pub items: Vec<FoundItem>,
    pub total: i64,
    pub page: u32,
    pub page_size: u32,
}

fn found_by_id(conn: &Connection, id: &str) -> Result<FoundItem, String> {
    conn.query_row("SELECT i.id,i.reference,i.name,i.category_id,c.name,i.description,i.color,i.brand,i.found_at,i.found_location,i.storage_location_id,s.name,s.secure,i.finder_name,i.finder_contact,i.staff_notes,i.status,i.retention_days,i.returned_at,i.disposed_at,i.created_at FROM found_items i JOIN categories c ON c.id=i.category_id JOIN storage_locations s ON s.id=i.storage_location_id WHERE i.id=?1",[id],|r|Ok(FoundItem{id:r.get(0)?,reference:r.get(1)?,name:r.get(2)?,category_id:r.get(3)?,category_name:r.get(4)?,description:r.get(5)?,color:r.get(6)?,brand:r.get(7)?,found_at:r.get(8)?,found_location:r.get(9)?,storage_location_id:r.get(10)?,storage_location:r.get(11)?,storage_secure:r.get::<_,i64>(12)?!=0,finder_name:r.get(13)?,finder_contact:r.get(14)?,staff_notes:r.get(15)?,status:r.get(16)?,retention_days:r.get(17)?,returned_at:r.get(18)?,disposed_at:r.get(19)?,created_at:r.get(20)?})).map_err(db_error)
}

pub fn organization(conn: &Connection) -> Result<Option<Organization>, String> {
    conn.query_row("SELECT id,name,organization_type,phone,email,street,city,region,postal_code,country,operating_hours_json,locale,date_format,retention_days,require_verification,allow_anonymous_finders,theme,primary_color,logo_data_url,legacy_operating_hours,staff_name FROM organization LIMIT 1",[],|r|Ok(Organization{id:r.get(0)?,name:r.get(1)?,organization_type:r.get(2)?,phone:r.get(3)?,email:r.get(4)?,street:r.get(5)?,city:r.get(6)?,region:r.get(7)?,postal_code:r.get(8)?,country:r.get(9)?,operating_hours:r.get(10)?,locale:r.get(11)?,date_format:r.get(12)?,retention_days:r.get(13)?,require_verification:r.get::<_,i64>(14)?!=0,allow_anonymous_finders:r.get::<_,i64>(15)?!=0,theme:r.get(16)?,primary_color:r.get(17)?,logo_data_url:r.get(18)?,legacy_operating_hours:r.get(19)?,staff_name:r.get(20)?})).optional().map_err(db_error)
}

pub fn categories(conn: &Connection, include_archived: bool) -> Result<Vec<Category>, String> {
    let mut stmt=conn.prepare("SELECT id,name,description,icon,active,sort_order,retention_days FROM categories WHERE (?1=1 OR active=1) ORDER BY sort_order,name").map_err(db_error)?;
    stmt.query_map([include_archived], |r| {
        Ok(Category {
            id: r.get(0)?,
            name: r.get(1)?,
            description: r.get(2)?,
            icon: r.get(3)?,
            active: r.get::<_, i64>(4)? != 0,
            sort_order: r.get(5)?,
            retention_days: r.get(6)?,
        })
    })
    .map_err(db_error)?
    .collect::<Result<Vec<_>, _>>()
    .map_err(db_error)
}

pub fn storage_locations(
    conn: &Connection,
    include_inactive: bool,
) -> Result<Vec<StorageLocation>, String> {
    let mut stmt=conn.prepare("SELECT s.id,s.name,s.description,s.parent_id,p.name,s.organization_location_id,o.name,s.secure,s.active,s.sort_order FROM storage_locations s LEFT JOIN storage_locations p ON p.id=s.parent_id LEFT JOIN organization_locations o ON o.id=s.organization_location_id WHERE (?1=1 OR s.active=1) ORDER BY s.sort_order,s.name").map_err(db_error)?;
    stmt.query_map([include_inactive], |r| {
        Ok(StorageLocation {
            id: r.get(0)?,
            name: r.get(1)?,
            description: r.get(2)?,
            parent_id: r.get(3)?,
            parent_name: r.get(4)?,
            organization_location_id: r.get(5)?,
            organization_location_name: r.get(6)?,
            secure: r.get::<_, i64>(7)? != 0,
            active: r.get::<_, i64>(8)? != 0,
            sort_order: r.get(9)?,
        })
    })
    .map_err(db_error)?
    .collect::<Result<Vec<_>, _>>()
    .map_err(db_error)
}

pub fn organization_locations(
    conn: &Connection,
    include_inactive: bool,
) -> Result<Vec<OrganizationLocation>, String> {
    let mut stmt=conn.prepare("SELECT id,name,street,city,region,postal_code,country,active FROM organization_locations WHERE (?1=1 OR active=1) ORDER BY active DESC,name COLLATE NOCASE").map_err(db_error)?;
    stmt.query_map([include_inactive], |r| {
        Ok(OrganizationLocation {
            id: r.get(0)?,
            name: r.get(1)?,
            street: r.get(2)?,
            city: r.get(3)?,
            region: r.get(4)?,
            postal_code: r.get(5)?,
            country: r.get(6)?,
            active: r.get::<_, i64>(7)? != 0,
        })
    })
    .map_err(db_error)?
    .collect::<Result<Vec<_>, _>>()
    .map_err(db_error)
}

pub fn save_organization_location(
    conn: &mut Connection,
    input: OrganizationLocationInput,
) -> Result<OrganizationLocation, String> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err("Location name is required.".into());
    }
    let duplicate:bool=conn.query_row("SELECT EXISTS(SELECT 1 FROM organization_locations WHERE name=?1 COLLATE NOCASE AND id<>COALESCE(?2,''))",params![name,input.id],|r|r.get(0)).map_err(db_error)?;
    if duplicate {
        return Err("An organization location with that name already exists.".into());
    }
    let now = now();
    let id = input.id.unwrap_or_else(new_id);
    // New sites are active by default. Editing an existing site preserves its
    // archived state; restoration is an explicit action in settings.
    conn.execute("INSERT INTO organization_locations(id,name,street,city,region,postal_code,country,active,created_at) VALUES(?1,?2,?3,?4,?5,?6,?7,1,?8) ON CONFLICT(id) DO UPDATE SET name=excluded.name,street=excluded.street,city=excluded.city,region=excluded.region,postal_code=excluded.postal_code,country=excluded.country",params![id,name,input.street,input.city,input.region,input.postal_code,input.country,now]).map_err(db_error)?;
    organization_locations(conn, true)?
        .into_iter()
        .find(|l| l.id == id)
        .ok_or_else(|| "Location could not be loaded after saving.".into())
}

pub fn set_organization_location_active(
    conn: &Connection,
    id: &str,
    active: bool,
) -> Result<(), String> {
    if !active {
        let other_active: i64 = conn
            .query_row(
                "SELECT count(*) FROM organization_locations WHERE active=1 AND id<>?1",
                [id],
                |r| r.get(0),
            )
            .map_err(db_error)?;
        if other_active == 0 {
            return Err("Keep at least one active organization location.".into());
        }
    }
    let changed = conn
        .execute(
            "UPDATE organization_locations SET active=?1 WHERE id=?2",
            params![active as i64, id],
        )
        .map_err(db_error)?;
    if changed == 0 {
        return Err("Organization location could not be found.".into());
    }
    Ok(())
}

pub fn create_organization(
    conn: &mut Connection,
    input: SetupInput,
) -> Result<Organization, String> {
    let name = input.name.trim();
    let location = input.location_name.trim();
    if name.is_empty() || location.is_empty() {
        return Err("Organization and location names are required.".into());
    }
    if !(1..=3650).contains(&input.retention_days) {
        return Err("Retention must be between 1 and 3650 days.".into());
    }
    if organization(conn)?.is_some() {
        return Err(
            "Organization setup has already been completed. Update settings instead.".into(),
        );
    }
    let tx = conn.transaction().map_err(db_error)?;
    let id = new_id();
    let location_id = new_id();
    let now = now();
    if !valid_operating_hours(&input.operating_hours) {
        return Err("Configure valid hours for each day. Mark overnight hours explicitly.".into());
    }
    if !valid_brand_color(&input.primary_color) {
        return Err("Enter a valid accessible brand color in #RRGGBB format.".into());
    }
    if input
        .logo_data_url
        .as_ref()
        .is_some_and(|logo| !valid_logo_data_url(logo))
    {
        return Err("Choose a PNG, JPEG, or WebP logo smaller than 2 MB.".into());
    }
    tx.execute("INSERT INTO organization(id,name,organization_type,phone,email,street,city,region,postal_code,country,operating_hours,operating_hours_json,locale,date_format,retention_days,require_verification,allow_anonymous_finders,theme,primary_color,logo_data_url,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,'',?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?20)",params![id,name,input.organization_type,input.phone,input.email,input.street,input.city,input.region,input.postal_code,input.country,input.operating_hours,input.locale,input.date_format,input.retention_days,input.require_verification as i64,input.allow_anonymous_finders as i64,input.theme,input.primary_color,input.logo_data_url,now]).map_err(db_error)?;
    tx.execute("INSERT INTO organization_locations(id,name,street,city,region,postal_code,country,created_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8)",params![location_id,location,input.street,input.city,input.region,input.postal_code,input.country,now]).map_err(db_error)?;
    for (name, description, secure, order) in [
        ("Front Desk", "Items waiting to be processed", false, 0),
        (
            "Lost & Found Cabinet",
            "General recovered property",
            false,
            1,
        ),
        (
            "Secure Drawer",
            "Valuables and restricted property",
            true,
            2,
        ),
    ] {
        tx.execute("INSERT INTO storage_locations(id,name,description,organization_location_id,secure,sort_order,created_at) VALUES(?1,?2,?3,?4,?5,?6,?7)",params![new_id(),name,description,location_id,secure as i64,order,now]).map_err(db_error)?;
    }
    tx.commit().map_err(db_error)?;
    organization(conn)?.ok_or_else(|| "Organization could not be loaded after setup.".into())
}

pub fn list_found(
    conn: &Connection,
    query: &str,
    category_id: Option<&str>,
    storage_id: Option<&str>,
    status: &str,
    date_from: &str,
    date_to: &str,
    page: u32,
    page_size: u32,
) -> Result<InventoryPage, String> {
    let page_size = page_size.clamp(1, 100);
    let page = page.max(1).min(u32::MAX / page_size);
    let offset = page.saturating_sub(1).saturating_mul(page_size);
    for date in [date_from, date_to] {
        if !date.is_empty() && chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d").is_err() {
            return Err("Use valid calendar dates for the inventory range.".into());
        }
    }
    if !date_from.is_empty() && !date_to.is_empty() && date_from > date_to {
        return Err("The start date must be on or before the end date.".into());
    }
    let needle = format!("%{}%", query.trim());
    let filter_status = if status == "all" { "%" } else { status };
    let total:i64=conn.query_row("SELECT count(*) FROM found_items i WHERE (?1='' OR i.reference LIKE ?2 OR i.name LIKE ?2 OR i.description LIKE ?2 OR i.color LIKE ?2 OR i.brand LIKE ?2) AND (?3 IS NULL OR i.category_id=?3) AND (?4 IS NULL OR i.storage_location_id=?4) AND (?5='%' OR i.status=?5) AND (?6='' OR date(i.found_at)>=date(?6)) AND (?7='' OR date(i.found_at)<=date(?7))",params![query.trim(),needle,category_id,storage_id,filter_status,date_from,date_to],|r|r.get(0)).map_err(db_error)?;
    let mut stmt=conn.prepare("SELECT i.id,i.reference,i.name,i.category_id,c.name,i.description,i.color,i.brand,i.found_at,i.found_location,i.storage_location_id,s.name,s.secure,i.finder_name,i.finder_contact,i.staff_notes,i.status,i.retention_days,i.returned_at,i.disposed_at,i.created_at FROM found_items i JOIN categories c ON c.id=i.category_id JOIN storage_locations s ON s.id=i.storage_location_id WHERE (?1='' OR i.reference LIKE ?2 OR i.name LIKE ?2 OR i.description LIKE ?2 OR i.color LIKE ?2 OR i.brand LIKE ?2) AND (?3 IS NULL OR i.category_id=?3) AND (?4 IS NULL OR i.storage_location_id=?4) AND (?5='%' OR i.status=?5) AND (?6='' OR date(i.found_at)>=date(?6)) AND (?7='' OR date(i.found_at)<=date(?7)) ORDER BY i.found_at DESC LIMIT ?8 OFFSET ?9").map_err(db_error)?;
    let items = stmt
        .query_map(
            params![
                query.trim(),
                needle,
                category_id,
                storage_id,
                filter_status,
                date_from,
                date_to,
                page_size,
                offset
            ],
            |r| {
                Ok(FoundItem {
                    id: r.get(0)?,
                    reference: r.get(1)?,
                    name: r.get(2)?,
                    category_id: r.get(3)?,
                    category_name: r.get(4)?,
                    description: r.get(5)?,
                    color: r.get(6)?,
                    brand: r.get(7)?,
                    found_at: r.get(8)?,
                    found_location: r.get(9)?,
                    storage_location_id: r.get(10)?,
                    storage_location: r.get(11)?,
                    storage_secure: r.get::<_, i64>(12)? != 0,
                    finder_name: r.get(13)?,
                    finder_contact: r.get(14)?,
                    staff_notes: r.get(15)?,
                    status: r.get(16)?,
                    retention_days: r.get(17)?,
                    returned_at: r.get(18)?,
                    disposed_at: r.get(19)?,
                    created_at: r.get(20)?,
                })
            },
        )
        .map_err(db_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_error)?;
    Ok(InventoryPage {
        items,
        total,
        page,
        page_size,
    })
}

pub fn update_lost(
    conn: &mut Connection,
    id: &str,
    input: LostInput,
) -> Result<LostReport, String> {
    let staff = current_staff_name(conn)?;
    if input.name.trim().is_empty() || input.claimant_name.trim().is_empty() {
        return Err("Item and claimant names are required.".into());
    }
    let tx = conn.transaction().map_err(db_error)?;
    let existing: Option<(String, String)> = tx
        .query_row(
            "SELECT status,reference FROM lost_reports WHERE id=?1",
            [id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()
        .map_err(db_error)?;
    let Some((status, reference)) = existing else {
        return Err("Lost report could not be found.".into());
    };
    if status == "resolved" {
        return Err("Resolved reports cannot be edited. Reopen the report first.".into());
    }
    let category_ok: bool = tx.query_row("SELECT EXISTS(SELECT 1 FROM categories WHERE id=?1 AND (active=1 OR id=(SELECT category_id FROM lost_reports WHERE id=?2)))", params![input.category_id,id], |r|r.get(0)).map_err(db_error)?;
    if !category_ok {
        return Err("Choose an active item category.".into());
    }
    tx.execute("UPDATE lost_reports SET name=?1,category_id=?2,description=?3,color=?4,brand=?5,lost_at=?6,last_location=?7,claimant_name=?8,contact=?9,notes=?10,updated_at=?11 WHERE id=?12",params![input.name.trim(),input.category_id,input.description,input.color,input.brand,input.lost_at,input.last_location,input.claimant_name.trim(),input.contact,input.notes,now(),id]).map_err(db_error)?;
    insert_event(
        &tx,
        "lost_report",
        id,
        "lost_report_updated",
        &now(),
        &staff,
        serde_json::json!({"reference":reference,"name":input.name.trim()}),
    )?;
    tx.commit().map_err(db_error)?;
    refresh_open_matches(conn);
    tx_load_lost(conn, id)
}

pub fn set_lost_status(conn: &mut Connection, id: &str, status: &str) -> Result<(), String> {
    let staff = current_staff_name(conn)?;
    if !["open", "closed"].contains(&status) {
        return Err("Lost reports can only be manually opened or closed.".into());
    }
    let tx = conn.transaction().map_err(db_error)?;
    let before: Option<String> = tx
        .query_row("SELECT status FROM lost_reports WHERE id=?1", [id], |r| {
            r.get(0)
        })
        .optional()
        .map_err(db_error)?;
    let Some(before) = before else {
        return Err("Lost report could not be found.".into());
    };
    if before == "resolved" && status == "closed" {
        return Err("A resolved report cannot be closed again.".into());
    }
    tx.execute(
        "UPDATE lost_reports SET status=?1,updated_at=?2 WHERE id=?3",
        params![status, now(), id],
    )
    .map_err(db_error)?;
    insert_event(
        &tx,
        "lost_report",
        id,
        if status == "open" {
            "lost_report_reopened"
        } else {
            "lost_report_closed"
        },
        &now(),
        &staff,
        serde_json::json!({"from":before,"to":status}),
    )?;
    tx.commit().map_err(db_error)
}

pub fn create_found(conn: &mut Connection, input: FoundInput) -> Result<FoundItem, String> {
    let staff = current_staff_name(conn)?;
    if input.name.trim().is_empty() {
        return Err("Item name is required.".into());
    }
    if conn
        .query_row(
            "SELECT active FROM categories WHERE id=?1",
            [&input.category_id],
            |r| r.get::<_, i64>(0),
        )
        .optional()
        .map_err(db_error)?
        != Some(1)
    {
        return Err("Choose an active item category.".into());
    }
    if conn
        .query_row(
            "SELECT active FROM storage_locations WHERE id=?1",
            [&input.storage_location_id],
            |r| r.get::<_, i64>(0),
        )
        .optional()
        .map_err(db_error)?
        != Some(1)
    {
        return Err("Choose an active storage location.".into());
    }
    let now = now();
    let id = new_id();
    let reference = new_reference("RCM");
    let tx = conn.transaction().map_err(db_error)?;
    tx.execute("INSERT INTO found_items(id,reference,name,category_id,description,color,brand,found_at,found_location,storage_location_id,finder_name,finder_contact,staff_notes,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?14)",params![id,reference,input.name.trim(),input.category_id,input.description,input.color,input.brand,input.found_at,input.found_location,input.storage_location_id,input.finder_name,input.finder_contact,input.staff_notes,now]).map_err(db_error)?;
    insert_event(
        &tx,
        "found_item",
        &id,
        "item_registered",
        &now,
        &staff,
        serde_json::json!({"reference":reference,"name":input.name.trim()}),
    )?;
    tx.commit().map_err(db_error)?;
    let item = found_by_id(conn, &id)?;
    refresh_open_matches(conn);
    Ok(item)
}

pub fn update_found(
    conn: &mut Connection,
    id: &str,
    input: FoundInput,
) -> Result<FoundItem, String> {
    let staff = current_staff_name(conn)?;
    let tx = conn.transaction().map_err(db_error)?;
    let before:Option<(String,String,String)>=tx.query_row("SELECT name,description,storage_location_id FROM found_items WHERE id=?1 AND status='in_custody'",[id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).optional().map_err(db_error)?;
    let Some((old_name, old_description, old_location)) = before else {
        return Err("This item is no longer in custody or could not be found.".into());
    };
    if input.name.trim().is_empty() {
        return Err("Item name is required.".into());
    }
    let category_ok:bool=tx.query_row("SELECT EXISTS(SELECT 1 FROM categories WHERE id=?1 AND (active=1 OR id=(SELECT category_id FROM found_items WHERE id=?2)))",params![input.category_id,id],|r|r.get(0)).map_err(db_error)?;
    if !category_ok {
        return Err("Choose an active item category.".into());
    }
    let storage_ok:bool=tx.query_row("SELECT EXISTS(SELECT 1 FROM storage_locations WHERE id=?1 AND (active=1 OR id=(SELECT storage_location_id FROM found_items WHERE id=?2)))",params![input.storage_location_id,id],|r|r.get(0)).map_err(db_error)?;
    if !storage_ok {
        return Err("Choose an active storage location.".into());
    }
    tx.execute("UPDATE found_items SET name=?1,category_id=?2,description=?3,color=?4,brand=?5,found_at=?6,found_location=?7,storage_location_id=?8,finder_name=?9,finder_contact=?10,staff_notes=?11,updated_at=?12 WHERE id=?13",params![input.name.trim(),input.category_id,input.description,input.color,input.brand,input.found_at,input.found_location,input.storage_location_id,input.finder_name,input.finder_contact,input.staff_notes,now(),id]).map_err(db_error)?;
    insert_event(
        &tx,
        "found_item",
        id,
        "item_updated",
        &now(),
        &staff,
        serde_json::json!({"before":{"name":old_name,"description":old_description,"storageLocationId":old_location},"after":{"name":input.name.trim(),"description":input.description,"storageLocationId":input.storage_location_id}}),
    )?;
    tx.commit().map_err(db_error)?;
    let item = found_by_id(conn, id)?;
    refresh_open_matches(conn);
    Ok(item)
}

pub fn move_found(
    conn: &mut Connection,
    id: &str,
    target_id: &str,
    staff_name: &str,
) -> Result<(), String> {
    let tx = conn.transaction().map_err(db_error)?;
    let old: String = tx
        .query_row(
            "SELECT storage_location_id FROM found_items WHERE id=?1 AND status='in_custody'",
            [id],
            |r| r.get(0),
        )
        .optional()
        .map_err(db_error)?
        .ok_or_else(|| "Only items in custody can be moved.".to_string())?;
    if tx
        .query_row(
            "SELECT active FROM storage_locations WHERE id=?1",
            [target_id],
            |r| r.get::<_, i64>(0),
        )
        .optional()
        .map_err(db_error)?
        != Some(1)
    {
        return Err("Choose an active storage location.".into());
    }
    if old == target_id {
        return Ok(());
    }
    let before: String = tx
        .query_row(
            "SELECT name FROM storage_locations WHERE id=?1",
            [&old],
            |r| r.get(0),
        )
        .map_err(db_error)?;
    let after: String = tx
        .query_row(
            "SELECT name FROM storage_locations WHERE id=?1",
            [target_id],
            |r| r.get(0),
        )
        .map_err(db_error)?;
    tx.execute(
        "UPDATE found_items SET storage_location_id=?1,updated_at=?2 WHERE id=?3",
        params![target_id, now(), id],
    )
    .map_err(db_error)?;
    insert_event(
        &tx,
        "found_item",
        id,
        "item_moved",
        &now(),
        staff_name,
        serde_json::json!({"before":{"storageLocationId":old,"storageLocation":before},"after":{"storageLocationId":target_id,"storageLocation":after}}),
    )?;
    tx.commit().map_err(db_error)
}

/// The adjudicated (confirmed) lost report for an item, when that report is
/// still open. Used to preselect the report when staff start the matching
/// return; staff remain free to choose a different open report.
pub fn confirmed_claim(
    conn: &Connection,
    found_item_id: &str,
) -> Result<Option<ConfirmedClaim>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT m.lost_report_id,r.reference,r.claimant_name FROM match_reviews m JOIN lost_reports r ON r.id=m.lost_report_id WHERE m.found_item_id=?1 AND m.status='confirmed' AND r.status='open' ORDER BY m.updated_at DESC LIMIT 1",
        )
        .map_err(db_error)?;
    let mut rows = stmt.query([found_item_id]).map_err(db_error)?;
    match rows.next().map_err(db_error)? {
        Some(row) => Ok(Some(ConfirmedClaim {
            lost_report_id: row.get(0).map_err(db_error)?,
            reference: row.get(1).map_err(db_error)?,
            claimant_name: row.get(2).map_err(db_error)?,
        })),
        None => Ok(None),
    }
}

pub fn return_found(
    conn: &mut Connection,
    input: ReturnInput,
    require_verification: bool,
    staff_name: &str,
) -> Result<(), String> {
    if input.recipient_name.trim().is_empty() {
        return Err("Recipient name is required.".into());
    }
    let method = input.verification_method.as_str();
    if ![
        "description_confirmed",
        "purchase_evidence",
        "photo_id_visual",
        "other",
        "none",
    ]
    .contains(&method)
    {
        return Err("Choose a valid verification method.".into());
    }
    let tx = conn.transaction().map_err(db_error)?;
    let item:Option<(String,String,i64,i64)>=tx.query_row("SELECT i.name,i.storage_location_id,s.secure,i.status='in_custody' FROM found_items i JOIN storage_locations s ON s.id=i.storage_location_id WHERE i.id=?1",[&input.found_item_id],|r|Ok((r.get(0)?,r.get(1)?,r.get::<_,i64>(2)?,r.get::<_,i64>(3)?))).optional().map_err(db_error)?;
    let Some((item_name, location_id, secure, in_custody)) = item else {
        return Err("This item could not be found.".into());
    };
    if in_custody == 0 {
        return Err("This item is no longer in custody.".into());
    }
    if (require_verification || secure != 0)
        && (method == "none" || input.verification_note.trim().is_empty())
    {
        return Err("Record how ownership was verified before returning this item.".into());
    }
    if let Some(report_id) = &input.lost_report_id {
        let valid: bool = tx
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM lost_reports WHERE id=?1 AND status='open')",
                [report_id],
                |r| r.get(0),
            )
            .map_err(db_error)?;
        if !valid {
            return Err("The related lost report is no longer open.".into());
        }
        let conflicting_claim:bool=tx.query_row("SELECT EXISTS(SELECT 1 FROM match_reviews WHERE found_item_id=?1 AND lost_report_id<>?2 AND status='confirmed')",params![input.found_item_id,report_id],|r|r.get(0)).map_err(db_error)?;
        if conflicting_claim {
            return Err("This item is already associated with another claimant. Review the competing claims before completing a return.".into());
        }
        let linked_elsewhere:bool=tx.query_row("SELECT EXISTS(SELECT 1 FROM match_reviews WHERE lost_report_id=?1 AND found_item_id<>?2 AND status='confirmed')",params![report_id,input.found_item_id],|r|r.get(0)).map_err(db_error)?;
        if linked_elsewhere {
            return Err("This lost report is already associated with a different item. Choose the report that matches this return.".into());
        }
    }
    let happened = now();
    tx.execute("UPDATE found_items SET status='returned',returned_at=?1,updated_at=?1 WHERE id=?2 AND status='in_custody'",params![happened,input.found_item_id]).map_err(db_error)?;
    if let Some(report_id) = &input.lost_report_id {
        tx.execute(
            "UPDATE lost_reports SET status='resolved',updated_at=?1 WHERE id=?2",
            params![happened, report_id],
        )
        .map_err(db_error)?;
        tx.execute("UPDATE match_reviews SET status='confirmed',updated_at=?1 WHERE lost_report_id=?2 AND found_item_id=?3",params![happened,report_id,input.found_item_id]).map_err(db_error)?;
        insert_event(
            &tx,
            "lost_report",
            report_id,
            "claim_confirmed",
            &happened,
            staff_name,
            serde_json::json!({"foundItemId":input.found_item_id,"reference":input.lost_report_id}),
        )?;
    }
    insert_event(
        &tx,
        "found_item",
        &input.found_item_id,
        "item_returned",
        &happened,
        staff_name,
        serde_json::json!({"itemName":item_name,"previousStorageLocationId":location_id,"recipientName":input.recipient_name.trim(),"lostReportId":input.lost_report_id,"verificationMethod":method,"verificationNote":input.verification_note.trim(),"staffNote":input.staff_note.trim()}),
    )?;
    tx.commit().map_err(db_error)
}

pub fn dispose_found(
    conn: &mut Connection,
    id: &str,
    method: &str,
    staff_name: &str,
) -> Result<(), String> {
    if method.trim().is_empty() {
        return Err("Choose a disposition method.".into());
    }
    let tx = conn.transaction().map_err(db_error)?;
    let retention:i64=tx.query_row("SELECT COALESCE(i.retention_days,c.retention_days,o.retention_days) FROM found_items i JOIN categories c ON c.id=i.category_id JOIN organization o ON 1=1 WHERE i.id=?1 AND i.status='in_custody'",[id],|r|r.get(0)).optional().map_err(db_error)?.ok_or_else(||"Only items in custody can be marked for disposition.".to_string())?;
    let eligible: bool = tx
        .query_row(
            "SELECT date(found_at,'+' || ?1 || ' days')<=date('now') FROM found_items WHERE id=?2",
            params![retention, id],
            |r| r.get(0),
        )
        .map_err(db_error)?;
    if !eligible {
        return Err("This item has not reached its retention review date yet.".into());
    }
    let happened = now();
    tx.execute("UPDATE found_items SET status='disposed',disposed_at=?1,disposition_method=?2,updated_at=?1 WHERE id=?3",params![happened,method.trim(),id]).map_err(db_error)?;
    insert_event(
        &tx,
        "found_item",
        id,
        "item_disposed",
        &happened,
        staff_name,
        serde_json::json!({"method":method.trim(),"retentionDays":retention}),
    )?;
    tx.commit().map_err(db_error)
}

fn tokens(value: &str) -> std::collections::HashSet<String> {
    value
        .to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|s| s.len() > 2)
        .map(str::to_string)
        .collect()
}
fn overlap(a: &str, b: &str) -> i64 {
    let a = tokens(a);
    let b = tokens(b);
    if a.is_empty() || b.is_empty() {
        return 0;
    }
    let shared = a.intersection(&b).count() as i64;
    ((shared * 10) / (a.len().max(b.len()) as i64)).min(10)
}

pub fn match_candidates(
    conn: &mut Connection,
    report_id: &str,
) -> Result<Vec<MatchCandidate>, String> {
    let report:Option<(String,String,String,String,String,String,String,String)>=conn.query_row("SELECT name,category_id,description,color,brand,lost_at,last_location,status FROM lost_reports WHERE id=?1",[report_id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?,r.get(5)?,r.get(6)?,r.get(7)?))).optional().map_err(db_error)?;
    let Some((name, category, description, color, brand, lost_at, last_location, status)) = report
    else {
        return Err("Lost report not found.".into());
    };
    if status != "open" {
        return Ok(vec![]);
    }
    let mut found_items = Vec::new();
    let mut page_number = 1;
    loop {
        let page = list_found(conn, "", None, None, "in_custody", "", "", page_number, 100)?;
        let count = page.items.len();
        found_items.extend(page.items);
        if count < 100 {
            break;
        }
        page_number = page_number.saturating_add(1);
    }
    let tx = conn.transaction().map_err(db_error)?;
    let mut candidates = Vec::new();
    for item in found_items {
        let mut score = 0;
        let mut explanation = Vec::new();
        if item.category_id == category {
            score += 34;
            explanation.push("Same category".to_string())
        }
        let name_score = overlap(&name, &item.name).min(10) * 2;
        if name_score > 0 {
            score += name_score;
            explanation.push("Similar item name".to_string())
        }
        let detail_score = overlap(&description, &item.description)
            + overlap(&description, &format!("{} {}", item.color, item.brand));
        if detail_score > 0 {
            score += detail_score;
            explanation.push("Description details overlap".to_string())
        }
        if !color.trim().is_empty() && color.eq_ignore_ascii_case(&item.color) {
            score += 10;
            explanation.push("Color matches".to_string())
        }
        if !brand.trim().is_empty() && brand.eq_ignore_ascii_case(&item.brand) {
            score += 10;
            explanation.push("Brand matches".to_string())
        }
        if !last_location.trim().is_empty() && overlap(&last_location, &item.found_location) > 0 {
            score += 8;
            explanation.push("Found near reported location".to_string())
        }
        let date_a = chrono::DateTime::parse_from_rfc3339(&lost_at)
            .ok()
            .map(|d| d.date_naive())
            .or_else(|| {
                chrono::NaiveDate::parse_from_str(&lost_at[..lost_at.len().min(10)], "%Y-%m-%d")
                    .ok()
            });
        let date_b = chrono::DateTime::parse_from_rfc3339(&item.found_at)
            .ok()
            .map(|d| d.date_naive())
            .or_else(|| {
                chrono::NaiveDate::parse_from_str(
                    &item.found_at[..item.found_at.len().min(10)],
                    "%Y-%m-%d",
                )
                .ok()
            });
        if let (Some(a), Some(b)) = (date_a, date_b) {
            let days = (a - b).num_days().abs();
            if days <= 3 {
                score += 14;
                explanation.push("Found within 3 days".to_string())
            } else if days <= 14 {
                score += 9;
                explanation.push("Found within 2 weeks".to_string())
            } else if days <= 30 {
                score += 4;
                explanation.push("Found within 30 days".to_string())
            }
        }
        score = score.min(100);
        let prior: Option<(String, String)> = tx
            .query_row(
                "SELECT id,status FROM match_reviews WHERE lost_report_id=?1 AND found_item_id=?2",
                params![report_id, item.id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()
            .map_err(db_error)?;
        let (review_id, review_status) = prior.unwrap_or_else(|| (new_id(), "suggested".into()));
        if score > 0 && review_status != "dismissed" && review_status != "confirmed" {
            tx.execute("INSERT INTO match_reviews(id,lost_report_id,found_item_id,status,score,explanation,updated_at) VALUES(?1,?2,?3,'suggested',?4,?5,?6) ON CONFLICT(lost_report_id,found_item_id) DO UPDATE SET score=excluded.score,explanation=excluded.explanation,updated_at=excluded.updated_at WHERE match_reviews.status='suggested'",params![review_id,report_id,item.id,score,explanation.join(" · "),now()]).map_err(db_error)?;
        }
        let competing_claims = {
            let mut stmt = tx.prepare("SELECT r.id,r.reference,r.claimant_name,r.name,m.status,m.score FROM match_reviews m JOIN lost_reports r ON r.id=m.lost_report_id WHERE m.found_item_id=?1 AND r.id<>?2 AND r.status='open' AND m.status IN ('suggested','confirmed') ORDER BY CASE m.status WHEN 'confirmed' THEN 0 ELSE 1 END,m.score DESC,r.created_at").map_err(db_error)?;
            stmt.query_map(params![item.id, report_id], |r| {
                Ok(CompetingClaim {
                    report_id: r.get(0)?,
                    reference: r.get(1)?,
                    claimant_name: r.get(2)?,
                    item_name: r.get(3)?,
                    status: r.get(4)?,
                    score: r.get(5)?,
                })
            })
            .map_err(db_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(db_error)?
        };
        candidates.push(MatchCandidate {
            found_item: item,
            score,
            explanation,
            review_status,
            competing_claims,
        });
    }
    tx.commit().map_err(db_error)?;
    candidates.retain(|c| {
        c.review_status == "dismissed" || (c.score > 0 && c.review_status != "confirmed")
    });
    candidates.sort_by(|a, b| {
        b.score
            .cmp(&a.score)
            .then_with(|| a.found_item.reference.cmp(&b.found_item.reference))
    });
    candidates.truncate(50);
    Ok(candidates)
}

pub fn refresh_open_matches(conn: &mut Connection) {
    let reports: Vec<String> = {
        let mut statement = match conn.prepare("SELECT id FROM lost_reports WHERE status='open'") {
            Ok(v) => v,
            Err(error) => {
                eprintln!("Reclaim match refresh could not read open reports: {error}");
                return;
            }
        };
        match statement
            .query_map([], |r| r.get(0))
            .and_then(|rows| rows.collect::<Result<Vec<String>, _>>())
        {
            Ok(v) => v,
            Err(error) => {
                eprintln!("Reclaim match refresh could not read open reports: {error}");
                return;
            }
        }
    };
    for report_id in reports {
        if let Err(error) = match_candidates(conn, &report_id) {
            eprintln!("Reclaim match refresh failed: {error}");
        }
    }
}

pub fn review_match(
    conn: &mut Connection,
    report_id: &str,
    item_id: &str,
    status: &str,
) -> Result<(), String> {
    let staff = current_staff_name(conn)?;
    if !["suggested", "dismissed", "confirmed"].contains(&status) {
        return Err("Invalid match review action.".into());
    }
    let tx = conn.transaction().map_err(db_error)?;
    let exists: bool = tx
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM lost_reports r,found_items i WHERE r.id=?1 AND i.id=?2)",
            params![report_id, item_id],
            |r| r.get(0),
        )
        .map_err(db_error)?;
    if !exists {
        return Err("The report or item could not be found.".into());
    }
    if status == "confirmed" {
        let eligible:bool=tx.query_row("SELECT EXISTS(SELECT 1 FROM lost_reports r JOIN found_items i ON i.id=?2 WHERE r.id=?1 AND r.status='open' AND i.status='in_custody')",params![report_id,item_id],|r|r.get(0)).map_err(db_error)?;
        if !eligible {
            return Err("Only open reports and items still in custody can be associated.".into());
        }
        let competing:bool=tx.query_row("SELECT EXISTS(SELECT 1 FROM match_reviews WHERE found_item_id=?1 AND lost_report_id<>?2 AND status='confirmed')",params![item_id,report_id],|r|r.get(0)).map_err(db_error)?;
        if competing {
            return Err("This item is already associated with another claimant. Review and remove that association before selecting a different claim.".into());
        }
    }
    let score:i64=tx.query_row("SELECT COALESCE((SELECT score FROM match_reviews WHERE lost_report_id=?1 AND found_item_id=?2),0)",params![report_id,item_id],|r|r.get(0)).map_err(db_error)?;
    tx.execute("INSERT INTO match_reviews(id,lost_report_id,found_item_id,status,score,updated_at) VALUES(?1,?2,?3,?4,?5,?6) ON CONFLICT(lost_report_id,found_item_id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at",params![new_id(),report_id,item_id,status,score,now()]).map_err(db_error)?;
    insert_event(
        &tx,
        "lost_report",
        report_id,
        "match_reviewed",
        &now(),
        &staff,
        serde_json::json!({"foundItemId":item_id,"status":status,"score":score}),
    )?;
    tx.commit().map_err(db_error)
}

pub fn adjudicate_match(
    conn: &mut Connection,
    report_id: &str,
    item_id: &str,
) -> Result<(), String> {
    let staff = current_staff_name(conn)?;
    let tx = conn.transaction().map_err(db_error)?;
    let winner: Option<(String, String, i64)> = tx.query_row(
        "SELECT r.reference,r.claimant_name,i.status='in_custody' FROM lost_reports r JOIN found_items i ON i.id=?2 WHERE r.id=?1 AND r.status='open'",
        params![report_id, item_id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    ).optional().map_err(db_error)?;
    let Some((reference, claimant, in_custody)) = winner else {
        return Err("Only an open lost report and found item can be adjudicated.".into());
    };
    if in_custody == 0 {
        return Err("The found item is no longer in custody.".into());
    }
    let score: i64 = tx.query_row(
        "SELECT COALESCE((SELECT score FROM match_reviews WHERE lost_report_id=?1 AND found_item_id=?2),0)",
        params![report_id,item_id], |r| r.get(0),
    ).map_err(db_error)?;
    let competing = {
        let mut stmt = tx.prepare("SELECT r.id,r.reference,r.claimant_name FROM match_reviews m JOIN lost_reports r ON r.id=m.lost_report_id WHERE m.found_item_id=?1 AND r.id<>?2 AND m.status IN ('suggested','confirmed')").map_err(db_error)?;
        stmt.query_map(params![item_id, report_id], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
            ))
        })
        .map_err(db_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_error)?
    };
    let timestamp = now();
    for (other_id, other_reference, other_claimant) in competing {
        tx.execute("UPDATE match_reviews SET status='dismissed',updated_at=?1 WHERE lost_report_id=?2 AND found_item_id=?3",params![timestamp,other_id,item_id]).map_err(db_error)?;
        insert_event(
            &tx,
            "lost_report",
            &other_id,
            "competing_claim_dismissed",
            &timestamp,
            &staff,
            serde_json::json!({"foundItemId":item_id,"selectedReportId":report_id,"selectedReference":reference}),
        )?;
        insert_event(
            &tx,
            "found_item",
            item_id,
            "competing_claim_dismissed",
            &timestamp,
            &staff,
            serde_json::json!({"reportId":other_id,"reference":other_reference,"claimantName":other_claimant,"selectedReportId":report_id}),
        )?;
    }
    tx.execute("INSERT INTO match_reviews(id,lost_report_id,found_item_id,status,score,updated_at) VALUES(?1,?2,?3,'confirmed',?4,?5) ON CONFLICT(lost_report_id,found_item_id) DO UPDATE SET status='confirmed',updated_at=excluded.updated_at",params![new_id(),report_id,item_id,score,timestamp]).map_err(db_error)?;
    insert_event(
        &tx,
        "lost_report",
        report_id,
        "match_reviewed",
        &timestamp,
        &staff,
        serde_json::json!({"foundItemId":item_id,"status":"confirmed","score":score,"adjudicated":true}),
    )?;
    insert_event(
        &tx,
        "found_item",
        item_id,
        "claim_adjudicated",
        &timestamp,
        &staff,
        serde_json::json!({"reportId":report_id,"reference":reference,"claimantName":claimant}),
    )?;
    tx.commit().map_err(db_error)
}

pub fn create_lost(conn: &mut Connection, input: LostInput) -> Result<LostReport, String> {
    let staff = current_staff_name(conn)?;
    if input.name.trim().is_empty() || input.claimant_name.trim().is_empty() {
        return Err("Item and claimant names are required.".into());
    }
    let now = now();
    let id = new_id();
    let reference = new_reference("RCL");
    let tx = conn.transaction().map_err(db_error)?;
    tx.execute("INSERT INTO lost_reports(id,reference,name,category_id,description,color,brand,lost_at,last_location,claimant_name,contact,notes,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?13)",params![id,reference,input.name.trim(),input.category_id,input.description,input.color,input.brand,input.lost_at,input.last_location,input.claimant_name.trim(),input.contact,input.notes,now]).map_err(db_error)?;
    insert_event(
        &tx,
        "lost_report",
        &id,
        "lost_report_registered",
        &now,
        &staff,
        serde_json::json!({"reference":reference,"name":input.name.trim()}),
    )?;
    tx.commit().map_err(db_error)?;
    let report = tx_load_lost(conn, &id)?;
    refresh_open_matches(conn);
    Ok(report)
}

fn tx_load_lost(conn: &Connection, id: &str) -> Result<LostReport, String> {
    conn.query_row("SELECT r.id,r.reference,r.name,r.category_id,c.name,r.description,r.color,r.brand,r.lost_at,r.last_location,r.claimant_name,r.contact,r.notes,r.status,r.created_at FROM lost_reports r JOIN categories c ON c.id=r.category_id WHERE r.id=?1",[id],|r|Ok(LostReport{id:r.get(0)?,reference:r.get(1)?,name:r.get(2)?,category_id:r.get(3)?,category_name:r.get(4)?,description:r.get(5)?,color:r.get(6)?,brand:r.get(7)?,lost_at:r.get(8)?,last_location:r.get(9)?,claimant_name:r.get(10)?,contact:r.get(11)?,notes:r.get(12)?,status:r.get(13)?,created_at:r.get(14)?})).map_err(db_error)
}

pub fn insert_event(
    conn: &Connection,
    record_type: &str,
    record_id: &str,
    event_type: &str,
    happened_at: &str,
    staff_name: &str,
    details: serde_json::Value,
) -> Result<(), String> {
    conn.execute("INSERT INTO custody_events(id,record_type,record_id,event_type,happened_at,staff_name,details) VALUES(?1,?2,?3,?4,?5,?6,?7)",params![new_id(),record_type,record_id,event_type,happened_at,staff_name,details.to_string()]).map_err(db_error)?;
    Ok(())
}

pub fn register_photo(
    conn: &mut Connection,
    item_id: &str,
    relative_path: &str,
    thumbnail_path: &str,
    mime_type: &str,
    byte_size: i64,
) -> Result<PhotoRecord, String> {
    let staff = current_staff_name(conn)?;
    let tx = conn.transaction().map_err(db_error)?;
    let active: bool = tx
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM found_items WHERE id=?1)",
            [item_id],
            |r| r.get(0),
        )
        .map_err(db_error)?;
    if !active {
        return Err("Found item does not exist.".into());
    }
    let id = new_id();
    let created = now();
    tx.execute("INSERT INTO item_photos(id,found_item_id,relative_path,thumbnail_path,mime_type,byte_size,created_at) VALUES(?1,?2,?3,?4,?5,?6,?7)",params![id,item_id,relative_path,thumbnail_path,mime_type,byte_size,created]).map_err(db_error)?;
    insert_event(
        &tx,
        "found_item",
        item_id,
        "photo_added",
        &created,
        &staff,
        serde_json::json!({"photoId":id}),
    )?;
    tx.commit().map_err(db_error)?;
    Ok(PhotoRecord {
        id,
        relative_path: relative_path.into(),
        thumbnail_path: Some(thumbnail_path.into()),
        mime_type: mime_type.into(),
        byte_size,
    })
}

pub fn photo_paths(conn: &Connection, item_id: &str) -> Result<Vec<(String, String)>, String> {
    let mut statement=conn.prepare("SELECT id,COALESCE(thumbnail_path,relative_path) FROM item_photos WHERE found_item_id=?1 ORDER BY created_at").map_err(db_error)?;
    statement
        .query_map([item_id], |r| Ok((r.get(0)?, r.get(1)?)))
        .map_err(db_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_error)
}

/// First managed photo per requested item: (item_id, photo_id, photo path).
/// Items without photos are simply absent so galleries can show a placeholder.
pub fn first_photo_paths(
    conn: &Connection,
    item_ids: &[String],
) -> Result<Vec<(String, String, String)>, String> {
    if item_ids.is_empty() {
        return Ok(Vec::new());
    }
    let sql = format!(
        "SELECT found_item_id,id,COALESCE(thumbnail_path,relative_path) FROM item_photos WHERE found_item_id IN ({}) ORDER BY found_item_id,created_at",
        vec!["?"; item_ids.len()].join(",")
    );
    let mut statement = conn.prepare(&sql).map_err(db_error)?;
    let rows = statement
        .query_map(params_from_iter(item_ids.iter()), |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
            ))
        })
        .map_err(db_error)?;
    let mut seen = std::collections::HashSet::new();
    let mut first_per_item = Vec::new();
    for row in rows {
        let (item_id, photo_id, path) = row.map_err(db_error)?;
        if seen.insert(item_id.clone()) {
            first_per_item.push((item_id, photo_id, path));
        }
    }
    Ok(first_per_item)
}

pub fn remove_photo_record(
    conn: &mut Connection,
    photo_id: &str,
) -> Result<Option<(String, String, String)>, String> {
    let staff = current_staff_name(conn)?;
    let tx = conn.transaction().map_err(db_error)?;
    let result:Option<(String,String,String)>=tx.query_row("SELECT found_item_id,relative_path,COALESCE(thumbnail_path,'') FROM item_photos WHERE id=?1",[photo_id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).optional().map_err(db_error)?;
    if let Some((item_id, _, _)) = &result {
        tx.execute("DELETE FROM item_photos WHERE id=?1", [photo_id])
            .map_err(db_error)?;
        insert_event(
            &tx,
            "found_item",
            item_id,
            "photo_removed",
            &now(),
            &staff,
            serde_json::json!({"photoId":photo_id}),
        )?;
    }
    tx.commit().map_err(db_error)?;
    Ok(result)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardStats {
    pub held: i64,
    pub open_reports: i64,
    pub found_today: i64,
    pub returned_period: i64,
    pub matches_to_review: i64,
    pub retention_review: i64,
    pub disposed_period: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RetentionRecord {
    pub item: FoundItem,
    pub review_date: String,
    pub days_remaining: i64,
    pub eligible: bool,
}

pub fn retention_queue(conn: &Connection) -> Result<Vec<RetentionRecord>, String> {
    let mut statement=conn.prepare("SELECT i.id,i.reference,i.name,i.category_id,c.name,i.description,i.color,i.brand,i.found_at,i.found_location,i.storage_location_id,s.name,s.secure,i.finder_name,i.finder_contact,i.staff_notes,i.status,i.retention_days,i.returned_at,i.disposed_at,i.created_at,date(i.found_at,'+' || COALESCE(i.retention_days,c.retention_days,o.retention_days) || ' days'),CAST(julianday(date(i.found_at,'+' || COALESCE(i.retention_days,c.retention_days,o.retention_days) || ' days'))-julianday(date('now')) AS INTEGER) FROM found_items i JOIN categories c ON c.id=i.category_id JOIN storage_locations s ON s.id=i.storage_location_id JOIN organization o ON 1=1 WHERE i.status IN ('in_custody','disposed') ORDER BY CASE WHEN i.status='in_custody' THEN 0 ELSE 1 END,date(i.found_at,'+' || COALESCE(i.retention_days,c.retention_days,o.retention_days) || ' days') LIMIT 500").map_err(db_error)?;
    statement
        .query_map([], |r| {
            let days: i64 = r.get(22)?;
            let status: String = r.get(16)?;
            Ok(RetentionRecord {
                item: FoundItem {
                    id: r.get(0)?,
                    reference: r.get(1)?,
                    name: r.get(2)?,
                    category_id: r.get(3)?,
                    category_name: r.get(4)?,
                    description: r.get(5)?,
                    color: r.get(6)?,
                    brand: r.get(7)?,
                    found_at: r.get(8)?,
                    found_location: r.get(9)?,
                    storage_location_id: r.get(10)?,
                    storage_location: r.get(11)?,
                    storage_secure: r.get::<_, i64>(12)? != 0,
                    finder_name: r.get(13)?,
                    finder_contact: r.get(14)?,
                    staff_notes: r.get(15)?,
                    status,
                    retention_days: r.get(17)?,
                    returned_at: r.get(18)?,
                    disposed_at: r.get(19)?,
                    created_at: r.get(20)?,
                },
                review_date: r.get(21)?,
                days_remaining: days,
                eligible: days <= 0,
            })
        })
        .map_err(db_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_error)
}

pub fn dashboard_stats(conn: &Connection) -> Result<DashboardStats, String> {
    let today = Local::now().date_naive().to_string();
    let held = conn
        .query_row(
            "SELECT count(*) FROM found_items WHERE status='in_custody'",
            [],
            |r| r.get(0),
        )
        .map_err(db_error)?;
    let reports = conn
        .query_row(
            "SELECT count(*) FROM lost_reports WHERE status='open'",
            [],
            |r| r.get(0),
        )
        .map_err(db_error)?;
    let found = conn
        .query_row(
            "SELECT count(*) FROM found_items WHERE substr(found_at,1,10)=?1",
            [&today],
            |r| r.get(0),
        )
        .map_err(db_error)?;
    let returned=conn.query_row("SELECT count(*) FROM found_items WHERE status='returned' AND substr(returned_at,1,10)=?1",[&today],|r|r.get(0)).map_err(db_error)?;
    let matches = conn
        .query_row(
            "SELECT count(*) FROM match_reviews WHERE status='suggested'",
            [],
            |r| r.get(0),
        )
        .map_err(db_error)?;
    let retention=conn.query_row("SELECT count(*) FROM found_items i JOIN organization o ON 1=1 WHERE i.status='in_custody' AND date(i.found_at, '+' || COALESCE(i.retention_days,(SELECT retention_days FROM categories c WHERE c.id=i.category_id),o.retention_days) || ' days') <= date('now','+7 days')",[],|r|r.get(0)).unwrap_or(0);
    let disposed=conn.query_row("SELECT count(*) FROM found_items WHERE status='disposed' AND substr(disposed_at,1,10)=?1",[&today],|r|r.get(0)).map_err(db_error)?;
    Ok(DashboardStats {
        held,
        open_reports: reports,
        found_today: found,
        returned_period: returned,
        matches_to_review: matches,
        retention_review: retention,
        disposed_period: disposed,
    })
}
