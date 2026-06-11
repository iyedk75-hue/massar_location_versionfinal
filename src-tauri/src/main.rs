use pbkdf2::pbkdf2_hmac;
use rand::{rngs::OsRng, RngCore};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sha2::Sha256;
use std::{
    fmt::Write,
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::Mutex,
};

const INIT_SQL: &str = include_str!("../../prisma/migrations/20260427213400_init/migration.sql");
const MIGRATION_CLIENT_EXTRA: &str =
    include_str!("../../prisma/migrations/20260430000000_client_extra_fields/migration.sql");
const MIGRATION_CAR_IMAGE_URL: &str =
    include_str!("../../prisma/migrations/20260501000000_car_image_url/migration.sql");
const MIGRATION_CLIENT_BIRTHPLACE_NATIONALITY_UNIQUE: &str = include_str!(
    "../../prisma/migrations/20260501010000_client_birthplace_nationality_unique/migration.sql"
);
const MIGRATION_RESERVATION_SECOND_CLIENT: &str =
    include_str!("../../prisma/migrations/20260501020000_reservation_second_client/migration.sql");
const MIGRATION_CLIENT_IS_ACTIVE: &str =
    include_str!("../../prisma/migrations/20260502000000_client_is_active/migration.sql");
const MIGRATION_AUTH_USERS: &str =
    include_str!("../../prisma/migrations/20260505000000_auth_users/migration.sql");
const PASSWORD_ITERATIONS: u32 = 120_000;
const DEV_DEFAULT_FULL_NAME: &str = "Dev Admin";
const DEV_DEFAULT_USERNAME: &str = "admin";
const DEV_DEFAULT_PASSWORD: &str = "admin12345";

struct AppState {
    db: Mutex<Connection>,
    auth_user: Mutex<Option<AuthUser>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthUser {
    id: i32,
    full_name: String,
    username: String,
}

#[derive(Debug)]
struct StoredUser {
    id: i32,
    full_name: String,
    username: String,
    password_salt: String,
    password_hash: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthState {
    authenticated: bool,
    requires_setup: bool,
    user: Option<AuthUser>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SeedSampleDataResult {
    success: bool,
    cars_created: i32,
    clients_created: i32,
    reservations_created: i32,
    payments_created: i32,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DatabaseFileResult {
    success: bool,
    path: String,
    message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegisterUserDto {
    full_name: String,
    username: String,
    password: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoginDto {
    username: String,
    password: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Car {
    id: i32,
    brand: String,
    model: String,
    registration_number: String,
    year: Option<i32>,
    fuel_type: String,
    transmission: String,
    daily_price: f64,
    status: String,
    mileage: Option<i32>,
    image_url: Option<String>,
    insurance_expiry_date: Option<String>,
    technical_visit_expiry_date: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateCarDto {
    brand: String,
    model: String,
    registration_number: String,
    year: Option<i32>,
    fuel_type: String,
    transmission: String,
    daily_price: f64,
    status: String,
    mileage: Option<i32>,
    image_url: Option<String>,
    insurance_expiry_date: Option<String>,
    technical_visit_expiry_date: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Client {
    id: i32,
    full_name: String,
    phone: String,
    cin: Option<String>,
    passport_number: Option<String>,
    driving_license: Option<String>,
    driving_license_date: Option<String>,
    cin_issue_date: Option<String>,
    cin_issue_place: Option<String>,
    birth_date: Option<String>,
    birth_place: Option<String>,
    nationality: Option<String>,
    address: Option<String>,
    is_active: bool,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateClientDto {
    full_name: String,
    phone: String,
    cin: Option<String>,
    passport_number: Option<String>,
    driving_license: Option<String>,
    driving_license_date: Option<String>,
    cin_issue_date: Option<String>,
    cin_issue_place: Option<String>,
    birth_date: Option<String>,
    birth_place: Option<String>,
    nationality: Option<String>,
    address: Option<String>,
    is_active: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Reservation {
    id: i32,
    client_id: i32,
    second_client_id: Option<i32>,
    car_id: i32,
    start_date: String,
    end_date: String,
    daily_price: f64,
    total_price: f64,
    deposit_amount: f64,
    status: String,
    pickup_mileage: Option<i32>,
    return_mileage: Option<i32>,
    pickup_fuel_level: Option<String>,
    return_fuel_level: Option<String>,
    notes: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Payment {
    id: i32,
    reservation_id: i32,
    amount: f64,
    #[serde(rename = "type")]
    payment_type: String,
    method: String,
    payment_date: String,
    note: Option<String>,
    created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreatePaymentDto {
    reservation_id: i32,
    amount: f64,
    #[serde(rename = "type")]
    payment_type: String,
    method: String,
    payment_date: Option<String>,
    note: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Contract {
    id: i32,
    reservation_id: i32,
    contract_number: String,
    pdf_path: Option<String>,
    status: String,
    generated_at: String,
    signed_at: Option<String>,
    created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateReservationDto {
    client_id: i32,
    second_client_id: Option<i32>,
    car_id: i32,
    start_date: String,
    end_date: String,
    daily_price: f64,
    total_price: f64,
    deposit_amount: f64,
    status: String,
    pickup_mileage: Option<i32>,
    return_mileage: Option<i32>,
    pickup_fuel_level: Option<String>,
    return_fuel_level: Option<String>,
    notes: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DashboardStats {
    total_cars: i32,
    available_cars: i32,
    rented_cars: i32,
    ongoing_reservations: i32,
    today_reservations: i32,
    monthly_revenue: f64,
    overdue_payments: i32,
    insurance_alerts: i32,
    technical_visit_alerts: i32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ArchiveStats {
    total: i32,
    clients: i32,
    cars: i32,
    reservations: i32,
    payments: i32,
    contracts: i32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ArchiveItem {
    id: i32,
    #[serde(rename = "type")]
    item_type: String,
    title: String,
    subtitle: Option<String>,
    description: Option<String>,
    archived_at: Option<String>,
    archived_reason: Option<String>,
    status: Option<String>,
    original_data: JsonValue,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateReservationStatusDto {
    status: String,
    return_mileage: Option<i32>,
    return_fuel_level: Option<String>,
}

fn db_path() -> Result<PathBuf, String> {
    let current_dir = std::env::current_dir().map_err(|error| error.to_string())?;
    let root = if current_dir.file_name().and_then(|name| name.to_str()) == Some("src-tauri") {
        current_dir
            .parent()
            .map(Path::to_path_buf)
            .ok_or("Impossible de résoudre le dossier projet")?
    } else {
        current_dir
    };

    Ok(root.join("prisma").join("dev.db"))
}

fn database_backup_file_name(prefix: &str) -> String {
    let timestamp = format_unix_seconds(unix_now_seconds())
        .replace(':', "-")
        .replace('T', "_");
    format!("{prefix}_{timestamp}.db")
}

fn unique_database_backup_path(directory: &Path, prefix: &str) -> PathBuf {
    let first = directory.join(database_backup_file_name(prefix));
    if !first.exists() {
        return first;
    }

    for index in 1..100 {
        let timestamp = format_unix_seconds(unix_now_seconds())
            .replace(':', "-")
            .replace('T', "_");
        let candidate = directory.join(format!("{prefix}_{timestamp}_{index}.db"));
        if !candidate.exists() {
            return candidate;
        }
    }

    directory.join(format!("{prefix}_{}.db", unix_now_seconds()))
}

fn sqlite_string_literal(value: &Path) -> String {
    value.to_string_lossy().replace('\'', "''")
}

fn validate_existing_database_file(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Err("Base de données introuvable.".to_string());
    }
    if !path.is_file() {
        return Err("Le chemin indiqué n'est pas un fichier.".to_string());
    }

    let connection = Connection::open(path)
        .map_err(|error| format!("Impossible d'ouvrir cette base de données SQLite : {error}"))?;
    let integrity: String = connection
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    if integrity != "ok" {
        return Err("La base SQLite choisie est corrompue.".to_string());
    }

    let app_table_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('Car', 'Client', 'Reservation', 'Payment', 'Contract')",
            [],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;

    if app_table_count < 5 {
        return Err(
            "La base choisie n'est pas une base de données de cette application.".to_string(),
        );
    }

    Ok(())
}

fn init_db() -> Result<Connection, String> {
    let path = db_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|error| error.to_string())?;

    let table_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('Car', 'Client', 'Reservation', 'Payment', 'Contract')",
            [],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;

    if table_count < 5 {
        connection
            .execute_batch(INIT_SQL)
            .map_err(|error| error.to_string())?;
    }

    // Apply client extra fields migration if columns don't exist yet
    let has_birth_date: bool = connection
        .prepare("PRAGMA table_info(Client)")
        .and_then(|mut stmt| {
            let cols: Result<Vec<String>, _> = stmt
                .query_map([], |row| row.get::<_, String>(1))
                .map(|iter| iter.flatten().collect());
            cols
        })
        .map(|cols| cols.iter().any(|c| c == "birthDate"))
        .unwrap_or(false);

    if !has_birth_date {
        connection
            .execute_batch(MIGRATION_CLIENT_EXTRA)
            .map_err(|error| error.to_string())?;
    }

    let has_car_image_url: bool = connection
        .prepare("PRAGMA table_info(Car)")
        .and_then(|mut stmt| {
            let cols: Result<Vec<String>, _> = stmt
                .query_map([], |row| row.get::<_, String>(1))
                .map(|iter| iter.flatten().collect());
            cols
        })
        .map(|cols| cols.iter().any(|c| c == "imageUrl"))
        .unwrap_or(false);

    if !has_car_image_url {
        connection
            .execute_batch(MIGRATION_CAR_IMAGE_URL)
            .map_err(|error| error.to_string())?;
    }

    if !has_column(&connection, "Client", "birthPlace") {
        connection
            .execute_batch(MIGRATION_CLIENT_BIRTHPLACE_NATIONALITY_UNIQUE)
            .map_err(|error| error.to_string())?;
    }

    if !has_column(&connection, "Reservation", "secondClientId") {
        connection
            .execute_batch(MIGRATION_RESERVATION_SECOND_CLIENT)
            .map_err(|error| error.to_string())?;
    }

    if !has_column(&connection, "Client", "isActive") {
        connection
            .execute_batch(MIGRATION_CLIENT_IS_ACTIVE)
            .map_err(|error| error.to_string())?;
    }

    if !has_table(&connection, "User") {
        connection
            .execute_batch(MIGRATION_AUTH_USERS)
            .map_err(|error| error.to_string())?;
    }

    ensure_archive_fields(&connection)?;

    seed_default_user_if_empty(&connection)?;

    Ok(connection)
}

fn has_table(connection: &Connection, table: &str) -> bool {
    connection
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
            params![table],
            |row| row.get::<_, i64>(0),
        )
        .map(|count| count > 0)
        .unwrap_or(false)
}

fn has_column(connection: &Connection, table: &str, column: &str) -> bool {
    let sql = format!("PRAGMA table_info({})", table);
    connection
        .prepare(&sql)
        .and_then(|mut stmt| {
            let cols: Result<Vec<String>, _> = stmt
                .query_map([], |row| row.get::<_, String>(1))
                .map(|iter| iter.flatten().collect());
            cols
        })
        .map(|cols| cols.iter().any(|c| c == column))
        .unwrap_or(false)
}

fn ensure_archive_fields(connection: &Connection) -> Result<(), String> {
    for table in ["Reservation", "Payment", "Contract"] {
        add_column_if_missing(connection, table, "archived", "BOOLEAN DEFAULT 0")?;
        add_column_if_missing(connection, table, "archivedAt", "TEXT")?;
        add_column_if_missing(connection, table, "archivedReason", "TEXT")?;
    }
    Ok(())
}

fn add_column_if_missing(
    connection: &Connection,
    table: &str,
    column: &str,
    definition: &str,
) -> Result<(), String> {
    if has_column(connection, table, column) {
        return Ok(());
    }
    let sql = format!("ALTER TABLE {table} ADD COLUMN {column} {definition}");
    connection
        .execute(&sql, [])
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn get_car_by_id(connection: &Connection, id: i64) -> Result<Car, String> {
    connection
        .query_row(
            "SELECT id, brand, model, registrationNumber, year, fuelType, transmission, dailyPrice, status, mileage, imageUrl, insuranceExpiryDate, technicalVisitExpiryDate, createdAt, updatedAt FROM Car WHERE id = ?1",
            params![id],
            map_car,
        )
        .map_err(|error| error.to_string())
}

fn get_client_by_id(connection: &Connection, id: i64) -> Result<Client, String> {
    connection
        .query_row(
            "SELECT id, fullName, phone, cin, passportNumber, drivingLicense, drivingLicenseDate, cinIssueDate, cinIssuePlace, birthDate, birthPlace, nationality, address, isActive, createdAt, updatedAt FROM Client WHERE id = ?1",
            params![id],
            map_client,
        )
        .map_err(|error| error.to_string())
}

fn get_reservation_by_id(connection: &Connection, id: i64) -> Result<Reservation, String> {
    connection
        .query_row(
            "SELECT id, clientId, secondClientId, carId, startDate, endDate, dailyPrice, totalPrice, depositAmount, status, pickupMileage, returnMileage, pickupFuelLevel, returnFuelLevel, notes, createdAt, updatedAt FROM Reservation WHERE id = ?1",
            params![id],
            map_reservation,
        )
        .map_err(|error| error.to_string())
}

fn get_payment_by_id(connection: &Connection, id: i64) -> Result<Payment, String> {
    connection
        .query_row(
            "SELECT id, reservationId, amount, type, method, paymentDate, note, createdAt FROM Payment WHERE id = ?1",
            params![id],
            map_payment,
        )
        .map_err(|error| error.to_string())
}

fn get_contract_by_id(connection: &Connection, id: i64) -> Result<Contract, String> {
    connection
        .query_row(
            "SELECT id, reservationId, contractNumber, pdfPath, status, generatedAt, signedAt, createdAt FROM Contract WHERE id = ?1",
            params![id],
            map_contract,
        )
        .map_err(|error| error.to_string())
}

fn get_user_by_username(
    connection: &Connection,
    username: &str,
) -> Result<Option<StoredUser>, String> {
    match connection.query_row(
        "SELECT id, fullName, username, passwordSalt, passwordHash FROM User WHERE lower(username) = lower(?1)",
        params![username],
        |row| {
            Ok(StoredUser {
                id: row.get(0)?,
                full_name: row.get(1)?,
                username: row.get(2)?,
                password_salt: row.get(3)?,
                password_hash: row.get(4)?,
            })
        },
    ) {
        Ok(user) => Ok(Some(user)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

fn count_users(connection: &Connection) -> Result<i64, String> {
    connection
        .query_row("SELECT COUNT(*) FROM User", [], |row| row.get(0))
        .map_err(|error| error.to_string())
}

fn seed_default_user_if_empty(connection: &Connection) -> Result<(), String> {
    if count_users(connection)? > 0 {
        return Ok(());
    }

    let salt = generate_password_salt();
    let hash = hash_password(DEV_DEFAULT_PASSWORD, &salt)?;
    connection
        .execute(
            "INSERT INTO User (fullName, username, passwordSalt, passwordHash, createdAt, updatedAt)
             VALUES (?1, ?2, ?3, ?4, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
            params![
                DEV_DEFAULT_FULL_NAME,
                normalize_username(DEV_DEFAULT_USERNAME),
                salt,
                hash
            ],
        )
        .map_err(map_user_db_error)?;

    Ok(())
}

fn normalize_username(username: &str) -> String {
    username.trim().to_lowercase()
}

fn validate_registration_input(input: &RegisterUserDto) -> Result<(), String> {
    if input.full_name.trim().len() < 2 {
        return Err("Le nom complet doit contenir au moins 2 caractères.".to_string());
    }
    let username = normalize_username(&input.username);
    if username.len() < 3 {
        return Err("Le nom d'utilisateur doit contenir au moins 3 caractères.".to_string());
    }
    if !username
        .chars()
        .all(|value| value.is_ascii_alphanumeric() || matches!(value, '.' | '_' | '-'))
    {
        return Err(
            "Le nom d'utilisateur accepte uniquement lettres, chiffres, point, tiret et underscore."
                .to_string(),
        );
    }
    if input.password.chars().count() < 8 {
        return Err("Le mot de passe doit contenir au moins 8 caractères.".to_string());
    }
    Ok(())
}

fn generate_password_salt() -> String {
    let mut salt = [0_u8; 16];
    OsRng.fill_bytes(&mut salt);
    encode_hex(&salt)
}

fn hash_password(password: &str, salt_hex: &str) -> Result<String, String> {
    let salt = decode_hex(salt_hex)?;
    let mut output = [0_u8; 32];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), &salt, PASSWORD_ITERATIONS, &mut output);
    Ok(encode_hex(&output))
}

fn encode_hex(bytes: &[u8]) -> String {
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        let _ = write!(&mut output, "{byte:02x}");
    }
    output
}

fn decode_hex(value: &str) -> Result<Vec<u8>, String> {
    if value.len() % 2 != 0 {
        return Err("Données de sécurité invalides.".to_string());
    }

    let mut bytes = Vec::with_capacity(value.len() / 2);
    for index in (0..value.len()).step_by(2) {
        let byte = u8::from_str_radix(&value[index..index + 2], 16)
            .map_err(|_| "Données de sécurité invalides.".to_string())?;
        bytes.push(byte);
    }
    Ok(bytes)
}

fn verify_password(password: &str, salt_hex: &str, expected_hash: &str) -> Result<bool, String> {
    let candidate = hash_password(password, salt_hex)?;
    Ok(candidate == expected_hash)
}

fn require_authenticated(state: &tauri::State<'_, AppState>) -> Result<AuthUser, String> {
    let user = state
        .auth_user
        .lock()
        .map_err(|error| error.to_string())?
        .clone();

    Ok(user.unwrap_or_else(guest_auth_user))
}

fn map_car(row: &rusqlite::Row<'_>) -> rusqlite::Result<Car> {
    Ok(Car {
        id: row.get(0)?,
        brand: row.get(1)?,
        model: row.get(2)?,
        registration_number: row.get(3)?,
        year: row.get(4)?,
        fuel_type: row.get(5)?,
        transmission: row.get(6)?,
        daily_price: row.get(7)?,
        status: row.get(8)?,
        mileage: row.get(9)?,
        image_url: row.get(10)?,
        insurance_expiry_date: row.get(11)?,
        technical_visit_expiry_date: row.get(12)?,
        created_at: row.get(13)?,
        updated_at: row.get(14)?,
    })
}

fn map_client(row: &rusqlite::Row<'_>) -> rusqlite::Result<Client> {
    Ok(Client {
        id: row.get(0)?,
        full_name: row.get(1)?,
        phone: row.get(2)?,
        cin: row.get(3)?,
        passport_number: row.get(4)?,
        driving_license: row.get(5)?,
        driving_license_date: row.get(6)?,
        cin_issue_date: row.get(7)?,
        cin_issue_place: row.get(8)?,
        birth_date: row.get(9)?,
        birth_place: row.get(10)?,
        nationality: row.get(11)?,
        address: row.get(12)?,
        is_active: row.get(13)?,
        created_at: row.get(14)?,
        updated_at: row.get(15)?,
    })
}

fn map_reservation(row: &rusqlite::Row<'_>) -> rusqlite::Result<Reservation> {
    Ok(Reservation {
        id: row.get(0)?,
        client_id: row.get(1)?,
        second_client_id: row.get(2)?,
        car_id: row.get(3)?,
        start_date: row.get(4)?,
        end_date: row.get(5)?,
        daily_price: row.get(6)?,
        total_price: row.get(7)?,
        deposit_amount: row.get(8)?,
        status: row.get(9)?,
        pickup_mileage: row.get(10)?,
        return_mileage: row.get(11)?,
        pickup_fuel_level: row.get(12)?,
        return_fuel_level: row.get(13)?,
        notes: row.get(14)?,
        created_at: row.get(15)?,
        updated_at: row.get(16)?,
    })
}

fn map_payment(row: &rusqlite::Row<'_>) -> rusqlite::Result<Payment> {
    Ok(Payment {
        id: row.get(0)?,
        reservation_id: row.get(1)?,
        amount: row.get(2)?,
        payment_type: row.get(3)?,
        method: row.get(4)?,
        payment_date: row.get(5)?,
        note: row.get(6)?,
        created_at: row.get(7)?,
    })
}

fn map_contract(row: &rusqlite::Row<'_>) -> rusqlite::Result<Contract> {
    Ok(Contract {
        id: row.get(0)?,
        reservation_id: row.get(1)?,
        contract_number: row.get(2)?,
        pdf_path: row.get(3)?,
        status: row.get(4)?,
        generated_at: row.get(5)?,
        signed_at: row.get(6)?,
        created_at: row.get(7)?,
    })
}

fn generate_contract_for_reservation(
    connection: &Connection,
    reservation_id: i32,
) -> Result<Contract, String> {
    if let Ok(existing) = connection.query_row(
        "SELECT id, reservationId, contractNumber, pdfPath, status, generatedAt, signedAt, createdAt FROM Contract WHERE reservationId = ?1",
        params![reservation_id],
        map_contract,
    ) {
        return Ok(existing);
    }

    let year: String = connection
        .query_row("SELECT strftime('%Y', 'now')", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    let next_number: i32 = connection
        .query_row("SELECT COUNT(*) + 1 FROM Contract", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    let contract_number = format!("CNT-{}-{:04}", year, next_number);

    let pdf_path = format!("contracts/{}.pdf", contract_number);

    connection
        .execute(
            "INSERT INTO Contract (reservationId, contractNumber, pdfPath, status, generatedAt, createdAt)
             VALUES (?1, ?2, ?3, 'GENERATED', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
            params![reservation_id, contract_number, pdf_path],
        )
        .map_err(|error| error.to_string())?;

    get_contract_by_id(connection, connection.last_insert_rowid())
}

#[tauri::command]
fn get_auth_state(state: tauri::State<'_, AppState>) -> Result<AuthState, String> {
    let user = state
        .auth_user
        .lock()
        .map_err(|error| error.to_string())?
        .clone()
        .unwrap_or_else(guest_auth_user);

    Ok(AuthState {
        authenticated: true,
        requires_setup: false,
        user: Some(user),
    })
}

#[tauri::command]
fn register_user(
    state: tauri::State<'_, AppState>,
    data: RegisterUserDto,
) -> Result<AuthState, String> {
    validate_registration_input(&data)?;
    let connection = state.db.lock().map_err(|error| error.to_string())?;

    if count_users(&connection)? > 0 {
        return Err("Un compte existe déjà. Connectez-vous pour continuer.".to_string());
    }

    let username = normalize_username(&data.username);
    let salt = generate_password_salt();
    let hash = hash_password(&data.password, &salt)?;

    connection
        .execute(
            "INSERT INTO User (fullName, username, passwordSalt, passwordHash, createdAt, updatedAt)
             VALUES (?1, ?2, ?3, ?4, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
            params![data.full_name.trim(), username, salt, hash],
        )
        .map_err(map_user_db_error)?;

    let auth_user = AuthUser {
        id: connection.last_insert_rowid() as i32,
        full_name: data.full_name.trim().to_string(),
        username,
    };
    drop(connection);

    *state.auth_user.lock().map_err(|error| error.to_string())? = Some(auth_user.clone());

    Ok(AuthState {
        authenticated: true,
        requires_setup: false,
        user: Some(auth_user),
    })
}

#[tauri::command]
fn login_user(state: tauri::State<'_, AppState>, data: LoginDto) -> Result<AuthState, String> {
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    let requires_setup = count_users(&connection)? == 0;
    if requires_setup {
        return Ok(AuthState {
            authenticated: false,
            requires_setup: true,
            user: None,
        });
    }

    let username = normalize_username(&data.username);
    let stored_user = get_user_by_username(&connection, &username)?
        .ok_or_else(|| "Identifiants invalides.".to_string())?;

    if !verify_password(
        &data.password,
        &stored_user.password_salt,
        &stored_user.password_hash,
    )? {
        return Err("Identifiants invalides.".to_string());
    }

    connection
        .execute(
            "UPDATE User SET lastLoginAt = strftime('%Y-%m-%dT%H:%M:%fZ','now'), updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?1",
            params![stored_user.id],
        )
        .map_err(|error| error.to_string())?;

    let auth_user = AuthUser {
        id: stored_user.id,
        full_name: stored_user.full_name,
        username: stored_user.username,
    };
    drop(connection);

    *state.auth_user.lock().map_err(|error| error.to_string())? = Some(auth_user.clone());

    Ok(AuthState {
        authenticated: true,
        requires_setup: false,
        user: Some(auth_user),
    })
}

#[tauri::command]
fn logout_user(state: tauri::State<'_, AppState>) -> Result<AuthState, String> {
    let user = guest_auth_user();
    *state.auth_user.lock().map_err(|error| error.to_string())? = Some(user.clone());

    Ok(AuthState {
        authenticated: true,
        requires_setup: false,
        user: Some(user),
    })
}

fn guest_auth_user() -> AuthUser {
    AuthUser {
        id: 0,
        full_name: "Acces libre".to_string(),
        username: "guest".to_string(),
    }
}

#[tauri::command]
fn save_database_copy(
    state: tauri::State<'_, AppState>,
    target_folder: String,
) -> Result<DatabaseFileResult, String> {
    let _ = require_authenticated(&state)?;
    let folder = PathBuf::from(target_folder.trim());
    if target_folder.trim().is_empty() {
        return Err("Indiquez un dossier local pour enregistrer la base.".to_string());
    }

    fs::create_dir_all(&folder)
        .map_err(|error| format!("Impossible de créer le dossier de sauvegarde : {error}"))?;

    let destination = unique_database_backup_path(&folder, "location_massar");
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    let sql = format!("VACUUM INTO '{}';", sqlite_string_literal(&destination));
    connection
        .execute_batch(&sql)
        .map_err(|error| format!("Impossible d'enregistrer la base : {error}"))?;

    Ok(DatabaseFileResult {
        success: true,
        path: destination.to_string_lossy().to_string(),
        message: "Base de données enregistrée localement.".to_string(),
    })
}

#[tauri::command]
fn mount_existing_database(
    state: tauri::State<'_, AppState>,
    source_path: String,
) -> Result<DatabaseFileResult, String> {
    let _ = require_authenticated(&state)?;
    let trimmed = source_path.trim();
    if trimmed.is_empty() {
        return Err("Indiquez le chemin de la base existante.".to_string());
    }

    let source = PathBuf::from(trimmed);
    validate_existing_database_file(&source)?;

    let current_path = db_path()?;
    let source_absolute = source.canonicalize().map_err(|error| error.to_string())?;
    if current_path.exists() {
        let current_absolute = current_path
            .canonicalize()
            .map_err(|error| error.to_string())?;
        if source_absolute == current_absolute {
            return Ok(DatabaseFileResult {
                success: true,
                path: current_absolute.to_string_lossy().to_string(),
                message: "Cette base est déjà la base active.".to_string(),
            });
        }
    }

    if let Some(parent) = current_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let backup_path = current_path
        .parent()
        .map(|parent| unique_database_backup_path(parent, "dev_before_mount"))
        .ok_or_else(|| "Impossible de préparer la sauvegarde de sécurité.".to_string())?;

    let mut guard = state.db.lock().map_err(|error| error.to_string())?;
    let had_previous_database = current_path.exists();
    if had_previous_database {
        let sql = format!("VACUUM INTO '{}';", sqlite_string_literal(&backup_path));
        guard.execute_batch(&sql).map_err(|error| {
            format!("Impossible de sauvegarder la base actuelle avant montage : {error}")
        })?;
    }

    let previous_connection = std::mem::replace(
        &mut *guard,
        Connection::open_in_memory().map_err(|error| error.to_string())?,
    );
    drop(previous_connection);

    if let Err(error) = fs::copy(&source_absolute, &current_path) {
        if had_previous_database {
            let _ = fs::copy(&backup_path, &current_path);
        }
        *guard = init_db()?;
        return Err(format!("Impossible de monter la base existante : {error}"));
    }

    match init_db() {
        Ok(new_connection) => {
            *guard = new_connection;
            Ok(DatabaseFileResult {
                success: true,
                path: current_path.to_string_lossy().to_string(),
                message: if had_previous_database {
                    format!(
                        "Base existante montée. Ancienne base sauvegardée dans {}",
                        backup_path.display()
                    )
                } else {
                    "Base existante montée.".to_string()
                },
            })
        }
        Err(error) => {
            if had_previous_database {
                let _ = fs::copy(&backup_path, &current_path);
            }
            *guard = init_db()?;
            Err(format!(
                "La base choisie n'a pas pu être initialisée : {error}"
            ))
        }
    }
}

#[tauri::command]
fn seed_ai_sample_data(state: tauri::State<'_, AppState>) -> Result<SeedSampleDataResult, String> {
    let _ = require_authenticated(&state)?;
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    let seed_index =
        count_users(&connection)? + count(&connection, "SELECT COUNT(*) FROM Reservation")? as i64;

    let brands_models = [
        ("Toyota", "Yaris", 105.0),
        ("Hyundai", "i20", 110.0),
        ("Renault", "Clio", 98.0),
        ("Peugeot", "208", 112.0),
        ("Kia", "Picanto", 94.0),
        ("Volkswagen", "Polo", 118.0),
        ("Seat", "Ibiza", 108.0),
        ("Dacia", "Sandero", 89.0),
    ];
    let client_names = [
        "Amine Ben Salem",
        "Sarra Gharbi",
        "Nour Trabelsi",
        "Walid Ben Hmida",
        "Meriem Khelifi",
        "Youssef Jaziri",
        "Ons Ben Yedder",
        "Karim Toumi",
        "Rania Sassi",
        "Hamza Mzoughi",
        "Aicha Ferjani",
        "Sami Kammoun",
        "Ines Rekik",
        "Mehdi Chatti",
        "Nesrine Ayadi",
        "Bilel Dhouib",
        "Imen Charfi",
        "Skander Achour",
        "Farah Abid",
        "Aziz Ben Amor",
        "Rim Hentati",
        "Houssem Bouraoui",
        "Nada Mhamdi",
        "Ghaith Sellami",
    ];

    let mut car_ids = Vec::new();
    let mut client_ids = Vec::new();

    for (index, (brand, model, daily_price)) in brands_models.iter().enumerate() {
        let registration = format!("ML-{:03}-{}", seed_index + index as i64 + 1, 200 + index);
        connection
            .execute(
                "INSERT INTO Car (brand, model, registrationNumber, year, fuelType, transmission, dailyPrice, status, mileage, imageUrl, insuranceExpiryDate, technicalVisitExpiryDate, createdAt, updatedAt)
                 VALUES (?1, ?2, ?3, ?4, 'ESSENCE', ?5, ?6, 'AVAILABLE', ?7, NULL, ?8, ?9, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
                params![
                    brand,
                    model,
                    registration,
                    2020 + (index as i32 % 5),
                    if index % 2 == 0 { "MANUAL" } else { "AUTOMATIC" },
                    daily_price,
                    25_000 + (index as i32 * 7_200),
                    iso_days_ago(-(30 + index as i64)),
                    iso_days_ago(-(45 + index as i64))
                ],
            )
            .map_err(|error| error.to_string())?;
        car_ids.push(connection.last_insert_rowid() as i32);
    }

    for (index, full_name) in client_names.iter().enumerate() {
        let phone = format!(
            "55{:06}",
            ((seed_index as usize + index + 1) % 900_000) + 100_000
        );
        connection
            .execute(
                "INSERT INTO Client (fullName, phone, cin, passportNumber, drivingLicense, drivingLicenseDate, cinIssueDate, cinIssuePlace, birthDate, birthPlace, nationality, address, isActive, createdAt, updatedAt)
                 VALUES (?1, ?2, ?3, NULL, ?4, ?5, ?6, 'Tunis', ?7, 'Tunis', 'Tunisienne', ?8, true, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
                params![
                    full_name,
                    phone,
                    format!("CIN{:06}", seed_index + index as i64 + 1),
                    format!("DL{:06}", seed_index + index as i64 + 1),
                    iso_days_ago(3650 + index as i64 * 11),
                    iso_days_ago(2200 + index as i64 * 7),
                    iso_days_ago(9000 + index as i64 * 17),
                    format!("Adresse {} - Tunis", index + 1),
                ],
            )
            .map_err(map_client_db_error)?;
        client_ids.push(connection.last_insert_rowid() as i32);
    }

    let mut reservations_created = 0_i32;
    let mut payments_created = 0_i32;

    for index in 0..96 {
        let client_id = client_ids[index % client_ids.len()];
        let second_client_id = if index % 5 == 0 {
            Some(client_ids[(index + 3) % client_ids.len()])
        } else {
            None
        };
        let car_id = car_ids[index % car_ids.len()];
        let duration_days = 2 + (index % 6) as i32;
        let start_days_ago = 220 - (index as i64 * 2);
        let start_hour = 8 + (index % 9) as i64;
        let end_hour = 9 + ((index + 2) % 8) as i64;
        let daily_price = brands_models[index % brands_models.len()].2 + ((index % 4) as f64 * 6.5);
        let total_price = daily_price * duration_days as f64;
        let deposit_amount = if index % 4 == 0 { 500.0 } else { 300.0 };
        let pickup_mileage = 30_000 + (index as i32 * 180);
        let return_mileage = pickup_mileage + 220 + ((index % 6) as i32 * 35);
        let start_date = iso_datetime_days_ago(start_days_ago, start_hour);
        let end_date = iso_datetime_days_ago(start_days_ago - duration_days as i64, end_hour);

        connection
            .execute(
                "INSERT INTO Reservation (clientId, secondClientId, carId, startDate, endDate, dailyPrice, totalPrice, depositAmount, status, pickupMileage, returnMileage, pickupFuelLevel, returnFuelLevel, notes, createdAt, updatedAt)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'COMPLETED', ?9, ?10, 'FULL', 'HALF', ?11, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
                params![
                    client_id,
                    second_client_id,
                    car_id,
                    start_date,
                    end_date,
                    daily_price,
                    total_price,
                    deposit_amount,
                    pickup_mileage,
                    return_mileage,
                    format!("Réservation test ML {}", index + 1),
                ],
            )
            .map_err(|error| error.to_string())?;
        let reservation_id = connection.last_insert_rowid() as i32;
        reservations_created += 1;

        if deposit_amount > 0.0 {
            connection
                .execute(
                    "INSERT INTO Payment (reservationId, amount, type, method, paymentDate, note, createdAt)
                     VALUES (?1, ?2, 'DEPOSIT', 'CASH', ?3, 'Caution test ML', strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
                    params![
                        reservation_id,
                        deposit_amount,
                        iso_datetime_days_ago(start_days_ago + 1, 10)
                    ],
                )
                .map_err(|error| error.to_string())?;
            payments_created += 1;
        }

        connection
            .execute(
                "INSERT INTO Payment (reservationId, amount, type, method, paymentDate, note, createdAt)
                 VALUES (?1, ?2, 'RENTAL_PAYMENT', ?3, ?4, 'Paiement location test ML', strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
                params![
                    reservation_id,
                    total_price,
                    if index % 3 == 0 { "CARD" } else if index % 3 == 1 { "CASH" } else { "TRANSFER" },
                    iso_datetime_days_ago(start_days_ago - duration_days as i64 + 1, 15)
                ],
            )
            .map_err(|error| error.to_string())?;
        payments_created += 1;

        if index % 7 == 0 {
            let refund_amount = if index % 14 == 0 {
                250.0
            } else {
                deposit_amount
            };
            connection
                .execute(
                    "INSERT INTO Payment (reservationId, amount, type, method, paymentDate, note, createdAt)
                     VALUES (?1, ?2, 'DEPOSIT_REFUND', 'CASH', ?3, 'Remboursement test ML', strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
                    params![
                        reservation_id,
                        refund_amount,
                        iso_datetime_days_ago(start_days_ago - duration_days as i64 + 2, 11)
                    ],
                )
                .map_err(|error| error.to_string())?;
            payments_created += 1;
        }
    }

    Ok(SeedSampleDataResult {
        success: true,
        cars_created: car_ids.len() as i32,
        clients_created: client_ids.len() as i32,
        reservations_created,
        payments_created,
        message: format!(
            "{} voitures, {} clients, {} réservations et {} paiements de test ont été générés.",
            car_ids.len(),
            client_ids.len(),
            reservations_created,
            payments_created
        ),
    })
}

#[tauri::command]
fn get_cars(state: tauri::State<'_, AppState>) -> Result<Vec<Car>, String> {
    let _ = require_authenticated(&state)?;
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare("SELECT id, brand, model, registrationNumber, year, fuelType, transmission, dailyPrice, status, mileage, imageUrl, insuranceExpiryDate, technicalVisitExpiryDate, createdAt, updatedAt FROM Car WHERE archived = 0 OR archived IS NULL ORDER BY createdAt DESC")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], map_car)
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn create_car(state: tauri::State<'_, AppState>, data: CreateCarDto) -> Result<Car, String> {
    let _ = require_authenticated(&state)?;
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    connection
        .execute(
            "INSERT INTO Car (brand, model, registrationNumber, year, fuelType, transmission, dailyPrice, status, mileage, imageUrl, insuranceExpiryDate, technicalVisitExpiryDate, createdAt, updatedAt)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
            params![
                data.brand,
                data.model,
                data.registration_number,
                data.year,
                data.fuel_type,
                data.transmission,
                data.daily_price,
                data.status,
                data.mileage,
                data.image_url,
                data.insurance_expiry_date,
                data.technical_visit_expiry_date
            ],
        )
        .map_err(|error| error.to_string())?;

    get_car_by_id(&connection, connection.last_insert_rowid())
}

#[tauri::command]
fn update_car(
    state: tauri::State<'_, AppState>,
    id: i32,
    data: CreateCarDto,
) -> Result<Car, String> {
    let _ = require_authenticated(&state)?;
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    connection
        .execute(
            "UPDATE Car
             SET brand = ?1, model = ?2, registrationNumber = ?3, year = ?4, fuelType = ?5,
                 transmission = ?6, dailyPrice = ?7, status = ?8, mileage = ?9,
                 imageUrl = ?10, insuranceExpiryDate = ?11, technicalVisitExpiryDate = ?12,
                 updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')
             WHERE id = ?13",
            params![
                data.brand,
                data.model,
                data.registration_number,
                data.year,
                data.fuel_type,
                data.transmission,
                data.daily_price,
                data.status,
                data.mileage,
                data.image_url,
                data.insurance_expiry_date,
                data.technical_visit_expiry_date,
                id
            ],
        )
        .map_err(|error| error.to_string())?;

    get_car_by_id(&connection, id.into())
}

#[tauri::command]
fn change_car_status(
    state: tauri::State<'_, AppState>,
    id: i32,
    status: String,
) -> Result<Car, String> {
    let _ = require_authenticated(&state)?;
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    connection
        .execute(
            "UPDATE Car SET status = ?1, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?2",
            params![status, id],
        )
        .map_err(|error| error.to_string())?;

    get_car_by_id(&connection, id.into())
}

#[tauri::command]
fn delete_car(state: tauri::State<'_, AppState>, id: i32) -> Result<(), String> {
    let _ = require_authenticated(&state)?;
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    connection
        .execute(
            "UPDATE Car SET archived = true, archivedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now'), archivedReason = 'Suppression logique', updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?1",
            params![id],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
fn get_clients(state: tauri::State<'_, AppState>) -> Result<Vec<Client>, String> {
    let _ = require_authenticated(&state)?;
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare("SELECT id, fullName, phone, cin, passportNumber, drivingLicense, drivingLicenseDate, cinIssueDate, cinIssuePlace, birthDate, birthPlace, nationality, address, isActive, createdAt, updatedAt FROM Client WHERE archived = 0 OR archived IS NULL ORDER BY createdAt DESC")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], map_client)
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn create_client(
    state: tauri::State<'_, AppState>,
    data: CreateClientDto,
) -> Result<Client, String> {
    let _ = require_authenticated(&state)?;
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    connection
        .execute(
            "INSERT INTO Client (fullName, phone, cin, passportNumber, drivingLicense, drivingLicenseDate, cinIssueDate, cinIssuePlace, birthDate, birthPlace, nationality, address, isActive, createdAt, updatedAt)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, COALESCE(?13, true), strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
            params![
                data.full_name,
                data.phone,
                data.cin,
                data.passport_number,
                data.driving_license,
                data.driving_license_date,
                data.cin_issue_date,
                data.cin_issue_place,
                data.birth_date,
                data.birth_place,
                data.nationality,
                data.address,
                data.is_active
            ],
        )
        .map_err(map_client_db_error)?;

    get_client_by_id(&connection, connection.last_insert_rowid())
}

#[tauri::command]
fn update_client(
    state: tauri::State<'_, AppState>,
    id: i32,
    data: CreateClientDto,
) -> Result<Client, String> {
    let _ = require_authenticated(&state)?;
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    connection
        .execute(
            "UPDATE Client
             SET fullName = ?1, phone = ?2, cin = ?3, passportNumber = ?4,
                 drivingLicense = ?5, drivingLicenseDate = ?6, cinIssueDate = ?7,
                 cinIssuePlace = ?8, birthDate = ?9, birthPlace = ?10, nationality = ?11, address = ?12,
                 updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')
             WHERE id = ?13",
            params![
                data.full_name,
                data.phone,
                data.cin,
                data.passport_number,
                data.driving_license,
                data.driving_license_date,
                data.cin_issue_date,
                data.cin_issue_place,
                data.birth_date,
                data.birth_place,
                data.nationality,
                data.address,
                id
            ],
        )
        .map_err(map_client_db_error)?;

    get_client_by_id(&connection, id.into())
}

#[tauri::command]
fn delete_client(state: tauri::State<'_, AppState>, id: i32) -> Result<(), String> {
    let _ = require_authenticated(&state)?;
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    connection
        .execute(
            "UPDATE Client SET archived = true, archivedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now'), archivedReason = 'Suppression logique', updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?1",
            params![id],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
fn get_reservations(state: tauri::State<'_, AppState>) -> Result<Vec<Reservation>, String> {
    let _ = require_authenticated(&state)?;
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare("SELECT id, clientId, secondClientId, carId, startDate, endDate, dailyPrice, totalPrice, depositAmount, status, pickupMileage, returnMileage, pickupFuelLevel, returnFuelLevel, notes, createdAt, updatedAt FROM Reservation WHERE archived = 0 OR archived IS NULL ORDER BY createdAt DESC")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], map_reservation)
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn create_reservation(
    state: tauri::State<'_, AppState>,
    data: CreateReservationDto,
) -> Result<Reservation, String> {
    let _ = require_authenticated(&state)?;
    let connection = state.db.lock().map_err(|error| error.to_string())?;

    let car_status: String = connection
        .query_row(
            "SELECT status FROM Car WHERE id = ?1 AND (archived = 0 OR archived IS NULL)",
            params![data.car_id],
            |row| row.get(0),
        )
        .map_err(|_| "Voiture introuvable".to_string())?;

    validate_reservation_data(&data)?;
    ensure_client_active(&connection, data.client_id, "Client")?;
    if let Some(second_client_id) = data.second_client_id {
        ensure_client_active(&connection, second_client_id, "Deuxième conducteur")?;
    }

    if car_status == "MAINTENANCE" || car_status == "UNAVAILABLE" {
        return Err("Cette voiture n'est pas disponible.".to_string());
    }

    if has_reservation_conflict(
        &connection,
        data.car_id,
        &data.start_date,
        &data.end_date,
        None,
    )? {
        return Err("Cette voiture est déjà réservée sur cette période.".to_string());
    }

    connection
        .execute(
            "INSERT INTO Reservation (clientId, secondClientId, carId, startDate, endDate, dailyPrice, totalPrice, depositAmount, status, pickupMileage, returnMileage, pickupFuelLevel, returnFuelLevel, notes, createdAt, updatedAt)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
            params![
                data.client_id,
                data.second_client_id,
                data.car_id,
                data.start_date,
                data.end_date,
                data.daily_price,
                data.total_price,
                data.deposit_amount,
                data.status,
                data.pickup_mileage,
                data.return_mileage,
                data.pickup_fuel_level,
                data.return_fuel_level,
                data.notes
            ],
        )
        .map_err(|error| error.to_string())?;

    let reservation_id = connection.last_insert_rowid();
    let reservation = get_reservation_by_id(&connection, reservation_id)?;

    Ok(reservation)
}

#[tauri::command]
fn deactivate_client(state: tauri::State<'_, AppState>, id: i32) -> Result<Client, String> {
    let _ = require_authenticated(&state)?;
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    connection
        .execute(
            "UPDATE Client SET isActive = false, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?1",
            params![id],
        )
        .map_err(|error| error.to_string())?;

    get_client_by_id(&connection, id.into())
}

#[tauri::command]
fn reactivate_client(state: tauri::State<'_, AppState>, id: i32) -> Result<Client, String> {
    let _ = require_authenticated(&state)?;
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    connection
        .execute(
            "UPDATE Client SET isActive = true, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?1",
            params![id],
        )
        .map_err(|error| error.to_string())?;

    get_client_by_id(&connection, id.into())
}

#[tauri::command]
fn update_reservation(
    state: tauri::State<'_, AppState>,
    id: i32,
    data: CreateReservationDto,
) -> Result<Reservation, String> {
    let _ = require_authenticated(&state)?;
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    let current_status: String = connection
        .query_row(
            "SELECT status FROM Reservation WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|_| "Réservation introuvable".to_string())?;

    if current_status == "ONGOING" || current_status == "COMPLETED" || current_status == "CANCELLED" {
        return Err("Une location en cours doit être clôturée avant modification.".to_string());
    }

    let car_status: String = connection
        .query_row(
            "SELECT status FROM Car WHERE id = ?1 AND (archived = 0 OR archived IS NULL)",
            params![data.car_id],
            |row| row.get(0),
        )
        .map_err(|_| "Voiture introuvable".to_string())?;

    validate_reservation_data(&data)?;
    ensure_client_active(&connection, data.client_id, "Client")?;
    if let Some(second_client_id) = data.second_client_id {
        ensure_client_active(&connection, second_client_id, "Deuxième conducteur")?;
    }

    if car_status == "MAINTENANCE" || car_status == "UNAVAILABLE" {
        return Err("Cette voiture n'est pas disponible.".to_string());
    }

    if has_reservation_conflict(
        &connection,
        data.car_id,
        &data.start_date,
        &data.end_date,
        Some(id),
    )? {
        return Err("Cette voiture est déjà réservée sur cette période.".to_string());
    }

    connection
        .execute(
            "UPDATE Reservation
             SET clientId = ?1, secondClientId = ?2, carId = ?3, startDate = ?4, endDate = ?5,
                 dailyPrice = ?6, totalPrice = ?7, depositAmount = ?8, status = ?9,
                 pickupMileage = ?10, returnMileage = ?11, pickupFuelLevel = ?12,
                 returnFuelLevel = ?13, notes = ?14,
                 updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')
             WHERE id = ?15",
            params![
                data.client_id,
                data.second_client_id,
                data.car_id,
                data.start_date,
                data.end_date,
                data.daily_price,
                data.total_price,
                data.deposit_amount,
                data.status,
                data.pickup_mileage,
                data.return_mileage,
                data.pickup_fuel_level,
                data.return_fuel_level,
                data.notes,
                id
            ],
        )
        .map_err(|error| error.to_string())?;

    get_reservation_by_id(&connection, id.into())
}

#[tauri::command]
fn update_reservation_status(
    state: tauri::State<'_, AppState>,
    id: i32,
    data: UpdateReservationStatusDto,
) -> Result<Reservation, String> {
    let _ = require_authenticated(&state)?;
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    let car_id: i32 = connection
        .query_row(
            "SELECT carId FROM Reservation WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    let current_status: String = connection
        .query_row(
            "SELECT status FROM Reservation WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;

    if data.status == "CANCELLED" && current_status != "EN_ATTENTE" && current_status != "RESERVED" {
        return Err("Seules les réservations à venir peuvent être annulées.".to_string());
    }

    if data.status == "ONGOING" {
        let ongoing_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM Reservation
                 WHERE carId = ?1
                   AND id <> ?2
                   AND status = 'ONGOING'
                   AND (archived = 0 OR archived IS NULL)",
                params![car_id, id],
                |row| row.get(0),
            )
            .map_err(|error| error.to_string())?;
        if ongoing_count > 0 {
            return Err("Cette voiture a deja une location en cours. Terminez-la avant de demarrer une autre reservation.".to_string());
        }
    }

    connection
        .execute(
            "UPDATE Reservation
             SET status = ?1, returnMileage = COALESCE(?2, returnMileage), returnFuelLevel = COALESCE(?3, returnFuelLevel),
                 updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now')
             WHERE id = ?4",
            params![data.status, data.return_mileage, data.return_fuel_level, id],
        )
        .map_err(|error| error.to_string())?;

    match data.status.as_str() {
        "ONGOING" => {
            connection
                .execute(
                    "UPDATE Car SET status = 'RENTED', updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?1",
                    params![car_id],
                )
                .map_err(|error| error.to_string())?;
            generate_contract_for_reservation(&connection, id)?;
        }
        "COMPLETED" | "CANCELLED" => {
            connection
                .execute(
                    "UPDATE Car SET status = 'AVAILABLE', updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?1",
                    params![car_id],
                )
                .map_err(|error| error.to_string())?;
        }
        _ => {}
    }

    get_reservation_by_id(&connection, id.into())
}

#[tauri::command]
fn delete_reservation(state: tauri::State<'_, AppState>, id: i32) -> Result<(), String> {
    let _ = require_authenticated(&state)?;
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    let (car_id, status): (i32, String) = connection
        .query_row(
            "SELECT carId, status FROM Reservation WHERE id = ?1",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Réservation introuvable.".to_string())?;

    if status != "COMPLETED" && status != "CANCELLED" {
        return Err(
            "Seules les réservations terminées ou annulées peuvent être archivées.".to_string(),
        );
    }

    connection
        .execute(
            "UPDATE Contract SET archived = true, archivedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now'), archivedReason = 'Réservation archivée' WHERE reservationId = ?1",
            params![id],
        )
        .map_err(|error| error.to_string())?;
    connection
        .execute(
            "UPDATE Payment SET archived = true, archivedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now'), archivedReason = 'Réservation archivée' WHERE reservationId = ?1",
            params![id],
        )
        .map_err(|error| error.to_string())?;
    connection
        .execute(
            "UPDATE Reservation SET archived = true, archivedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now'), archivedReason = 'Suppression logique', updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?1",
            params![id],
        )
        .map_err(|error| error.to_string())?;

    if status == "COMPLETED" || status == "CANCELLED" {
        connection
            .execute(
                "UPDATE Car SET status = 'AVAILABLE', updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?1",
                params![car_id],
            )
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn get_payments(state: tauri::State<'_, AppState>) -> Result<Vec<Payment>, String> {
    let _ = require_authenticated(&state)?;
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare("SELECT id, reservationId, amount, type, method, paymentDate, note, createdAt FROM Payment WHERE archived = 0 OR archived IS NULL ORDER BY paymentDate DESC")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], map_payment)
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn create_payment(
    state: tauri::State<'_, AppState>,
    data: CreatePaymentDto,
) -> Result<Payment, String> {
    let _ = require_authenticated(&state)?;
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    validate_payment_data(&connection, &data)?;

    connection
        .execute(
            "INSERT INTO Payment (reservationId, amount, type, method, paymentDate, note, createdAt)
             VALUES (?1, ?2, ?3, ?4, COALESCE(?5, strftime('%Y-%m-%dT%H:%M:%fZ','now')), ?6, strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
            params![
                data.reservation_id,
                data.amount,
                data.payment_type,
                data.method,
                data.payment_date,
                data.note
            ],
        )
        .map_err(|error| error.to_string())?;

    get_payment_by_id(&connection, connection.last_insert_rowid())
}

#[tauri::command]
fn get_contracts(state: tauri::State<'_, AppState>) -> Result<Vec<Contract>, String> {
    let _ = require_authenticated(&state)?;
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare("SELECT id, reservationId, contractNumber, pdfPath, status, generatedAt, signedAt, createdAt FROM Contract WHERE archived = 0 OR archived IS NULL ORDER BY generatedAt DESC")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], map_contract)
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn generate_contract(
    state: tauri::State<'_, AppState>,
    reservation_id: i32,
) -> Result<Contract, String> {
    let _ = require_authenticated(&state)?;
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    generate_contract_for_reservation(&connection, reservation_id)
}

#[tauri::command]
fn get_archive_stats(state: tauri::State<'_, AppState>) -> Result<ArchiveStats, String> {
    let _ = require_authenticated(&state)?;
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    let clients = 0;
    let cars = 0;
    let reservations = count(
        &connection,
        "SELECT COUNT(*) FROM Reservation WHERE archived = 1",
    )?;
    let payments = count(
        &connection,
        "SELECT COUNT(*) FROM Payment WHERE archived = 1",
    )?;
    let contracts = count(
        &connection,
        "SELECT COUNT(*) FROM Contract WHERE archived = 1",
    )?;

    Ok(ArchiveStats {
        total: clients + cars + reservations + payments + contracts,
        clients,
        cars,
        reservations,
        payments,
        contracts,
    })
}

#[tauri::command]
fn get_archived_items(state: tauri::State<'_, AppState>) -> Result<Vec<ArchiveItem>, String> {
    let _ = require_authenticated(&state)?;
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    let mut items = Vec::new();
    append_archived_reservations(&connection, &mut items)?;
    append_archived_payments(&connection, &mut items)?;
    append_archived_contracts(&connection, &mut items)?;
    items.sort_by(|a, b| b.archived_at.cmp(&a.archived_at));
    Ok(items)
}

#[tauri::command]
fn archive_item(
    state: tauri::State<'_, AppState>,
    item_type: String,
    id: i32,
    reason: Option<String>,
) -> Result<(), String> {
    let _ = require_authenticated(&state)?;
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    let reason = reason.unwrap_or_else(|| "Archivage manuel".to_string());

    match item_type.as_str() {
        "client" | "car" => {
            Err("L\u{2019}archivage des clients et voitures sera ajout\u{00e9} plus tard.".to_string())
        }
        "contract" => archive_table_row(&connection, "Contract", id, &reason),
        "reservation" => {
            let status: String = connection
                .query_row(
                    "SELECT status FROM Reservation WHERE id = ?1",
                    params![id],
                    |row| row.get(0),
                )
                .map_err(|_| "R\u{00e9}servation introuvable.".to_string())?;
            if !is_archivable_reservation_status(&status) {
                return Err("Impossible d\u{2019}archiver une r\u{00e9}servation active ou \u{00e0} venir.".to_string());
            }
            archive_table_row(&connection, "Reservation", id, &reason)?;
            connection
                .execute(
                    "UPDATE Contract SET archived = 1, archivedAt = datetime('now'), archivedReason = ?2 WHERE reservationId = ?1",
                    params![id, reason],
                )
                .map_err(|error| error.to_string())?;
            Ok(())
        }
        "payment" => archive_table_row(&connection, "Payment", id, &reason),
        _ => Err("Type d'archive invalide.".to_string()),
    }
}

#[tauri::command]
fn restore_archived_item(
    state: tauri::State<'_, AppState>,
    item_type: String,
    id: i32,
) -> Result<(), String> {
    let _ = require_authenticated(&state)?;
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    match item_type.as_str() {
        "client" | "car" => {
            Err("L\u{2019}archivage des clients et voitures sera ajout\u{00e9} plus tard.".to_string())
        }
        "reservation" => restore_table_row(&connection, "Reservation", id),
        "payment" => restore_table_row(&connection, "Payment", id),
        "contract" => restore_table_row(&connection, "Contract", id),
        _ => Err("Type d'archive invalide.".to_string()),
    }
}

#[tauri::command]
fn permanently_delete_archived_item(
    state: tauri::State<'_, AppState>,
    item_type: String,
    id: i32,
) -> Result<(), String> {
    let _ = require_authenticated(&state)?;
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    match item_type.as_str() {
        "client" | "car" => {
            Err("L\u{2019}archivage des clients et voitures sera ajout\u{00e9} plus tard.".to_string())
        }
        "reservation" => delete_archived_table_row(&connection, "Reservation", id),
        "payment" => delete_archived_table_row(&connection, "Payment", id),
        "contract" => delete_archived_table_row(&connection, "Contract", id),
        _ => Err("Type d'archive invalide.".to_string()),
    }
}

#[tauri::command]
fn get_dashboard_stats(state: tauri::State<'_, AppState>) -> Result<DashboardStats, String> {
    let _ = require_authenticated(&state)?;
    let connection = state.db.lock().map_err(|error| error.to_string())?;
    let total_cars = count(
        &connection,
        "SELECT COUNT(*) FROM Car WHERE archived = 0 OR archived IS NULL",
    )?;
    let available_cars = count(
        &connection,
        "SELECT COUNT(*) FROM Car WHERE status = 'AVAILABLE' AND (archived = 0 OR archived IS NULL)",
    )?;
    let rented_cars = count(
        &connection,
        "SELECT COUNT(*) FROM Car WHERE status = 'RENTED' AND (archived = 0 OR archived IS NULL)",
    )?;
    let ongoing_reservations = count(
        &connection,
        "SELECT COUNT(*) FROM Reservation WHERE status = 'ONGOING' AND (archived = 0 OR archived IS NULL)",
    )?;
    let today_reservations = count(
        &connection,
        "SELECT COUNT(*) FROM Reservation WHERE date(startDate) = date('now') AND (archived = 0 OR archived IS NULL)",
    )?;
    let monthly_revenue: f64 = connection
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM Payment WHERE type = 'RENTAL_PAYMENT' AND strftime('%Y-%m', paymentDate) = strftime('%Y-%m', 'now') AND (archived = 0 OR archived IS NULL)",
            [],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    let insurance_alerts = count(
        &connection,
        "SELECT COUNT(*) FROM Car WHERE insuranceExpiryDate IS NOT NULL AND (archived = 0 OR archived IS NULL) AND date(insuranceExpiryDate) BETWEEN date('now') AND date('now', '+30 days')",
    )?;
    let technical_visit_alerts = count(
        &connection,
        "SELECT COUNT(*) FROM Car WHERE technicalVisitExpiryDate IS NOT NULL AND (archived = 0 OR archived IS NULL) AND date(technicalVisitExpiryDate) BETWEEN date('now') AND date('now', '+30 days')",
    )?;

    Ok(DashboardStats {
        total_cars,
        available_cars,
        rented_cars,
        ongoing_reservations,
        today_reservations,
        monthly_revenue,
        overdue_payments: 0,
        insurance_alerts,
        technical_visit_alerts,
    })
}

fn count(connection: &Connection, sql: &str) -> Result<i32, String> {
    connection
        .query_row(sql, [], |row| row.get(0))
        .map_err(|error| error.to_string())
}

fn is_archivable_reservation_status(status: &str) -> bool {
    matches!(
        status,
        "COMPLETED" | "CANCELLED" | "TERMIN\u{00c9}E" | "ANNUL\u{00c9}E"
    )
}

fn archive_table_row(
    connection: &Connection,
    table: &str,
    id: i32,
    reason: &str,
) -> Result<(), String> {
    let sql = format!(
        "UPDATE {table} SET archived = 1, archivedAt = datetime('now'), archivedReason = ?1 WHERE id = ?2"
    );
    let changed = connection
        .execute(&sql, params![reason, id])
        .map_err(|error| error.to_string())?;
    if changed == 0 {
        return Err("\u{00c9}l\u{00e9}ment introuvable.".to_string());
    }
    Ok(())
}

fn restore_table_row(connection: &Connection, table: &str, id: i32) -> Result<(), String> {
    let sql = format!(
        "UPDATE {table} SET archived = false, archivedAt = NULL, archivedReason = NULL WHERE id = ?1"
    );
    connection
        .execute(&sql, params![id])
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn delete_archived_table_row(connection: &Connection, table: &str, id: i32) -> Result<(), String> {
    let sql = format!("DELETE FROM {table} WHERE id = ?1 AND archived = 1");
    let changed = connection
        .execute(&sql, params![id])
        .map_err(|error| error.to_string())?;
    if changed == 0 {
        return Err("Élément archivé introuvable.".to_string());
    }
    Ok(())
}

fn append_archived_reservations(
    connection: &Connection,
    items: &mut Vec<ArchiveItem>,
) -> Result<(), String> {
    let mut statement = connection
        .prepare(
            "SELECT Reservation.id, Reservation.startDate, Reservation.endDate, Reservation.totalPrice, Reservation.depositAmount, Reservation.status, Reservation.archivedAt, Reservation.archivedReason, Client.fullName, Car.brand, Car.model, Car.registrationNumber
             FROM Reservation
             LEFT JOIN Client ON Client.id = Reservation.clientId
             LEFT JOIN Car ON Car.id = Reservation.carId
             WHERE Reservation.archived = 1",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            let id: i32 = row.get(0)?;
            let start_date: String = row.get(1)?;
            let end_date: String = row.get(2)?;
            let total_price: f64 = row.get(3)?;
            let deposit_amount: f64 = row.get(4)?;
            let status: String = row.get(5)?;
            let archived_at: Option<String> = row.get(6)?;
            let archived_reason: Option<String> = row.get(7)?;
            let client_name: Option<String> = row.get(8)?;
            let brand: Option<String> = row.get(9)?;
            let model: Option<String> = row.get(10)?;
            let registration: Option<String> = row.get(11)?;
            Ok(ArchiveItem {
                id,
                item_type: "reservation".to_string(),
                title: format!("Réservation #{id}"),
                subtitle: client_name.clone(),
                description: Some(format!("{} {} | {} -> {}", brand.clone().unwrap_or_default(), model.clone().unwrap_or_default(), start_date, end_date)),
                archived_at,
                archived_reason,
                status: Some(status.clone()),
                original_data: serde_json::json!({ "id": id, "client": client_name, "car": format!("{} {}", brand.unwrap_or_default(), model.unwrap_or_default()), "registrationNumber": registration, "startDate": start_date, "endDate": end_date, "totalPrice": total_price, "depositAmount": deposit_amount, "status": status }),
            })
        })
        .map_err(|error| error.to_string())?;
    items.extend(
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?,
    );
    Ok(())
}

fn append_archived_payments(
    connection: &Connection,
    items: &mut Vec<ArchiveItem>,
) -> Result<(), String> {
    let mut statement = connection
        .prepare(
            "SELECT Payment.id, Payment.reservationId, Payment.amount, Payment.type, Payment.method, Payment.paymentDate, Payment.archivedAt, Payment.archivedReason, Client.fullName
             FROM Payment
             LEFT JOIN Reservation ON Reservation.id = Payment.reservationId
             LEFT JOIN Client ON Client.id = Reservation.clientId
             WHERE Payment.archived = 1",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            let id: i32 = row.get(0)?;
            let reservation_id: i32 = row.get(1)?;
            let amount: f64 = row.get(2)?;
            let payment_type: String = row.get(3)?;
            let method: String = row.get(4)?;
            let payment_date: String = row.get(5)?;
            let archived_at: Option<String> = row.get(6)?;
            let archived_reason: Option<String> = row.get(7)?;
            let client_name: Option<String> = row.get(8)?;
            Ok(ArchiveItem {
                id,
                item_type: "payment".to_string(),
                title: format!("{amount:.2} DT"),
                subtitle: Some(format!("Réservation #{reservation_id}")),
                description: Some(format!("{payment_type} | {method} | {payment_date}")),
                archived_at,
                archived_reason,
                status: Some(payment_type.clone()),
                original_data: serde_json::json!({ "id": id, "reservationId": reservation_id, "client": client_name, "amount": amount, "type": payment_type, "method": method, "paymentDate": payment_date }),
            })
        })
        .map_err(|error| error.to_string())?;
    items.extend(
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?,
    );
    Ok(())
}

fn append_archived_contracts(
    connection: &Connection,
    items: &mut Vec<ArchiveItem>,
) -> Result<(), String> {
    let mut statement = connection
        .prepare(
            "SELECT Contract.id, Contract.reservationId, Contract.contractNumber, Contract.status, Contract.generatedAt, Contract.archivedAt, Contract.archivedReason, Client.fullName, Car.brand, Car.model
             FROM Contract
             LEFT JOIN Reservation ON Reservation.id = Contract.reservationId
             LEFT JOIN Client ON Client.id = Reservation.clientId
             LEFT JOIN Car ON Car.id = Reservation.carId
             WHERE Contract.archived = 1",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            let id: i32 = row.get(0)?;
            let reservation_id: i32 = row.get(1)?;
            let contract_number: String = row.get(2)?;
            let status: String = row.get(3)?;
            let generated_at: String = row.get(4)?;
            let archived_at: Option<String> = row.get(5)?;
            let archived_reason: Option<String> = row.get(6)?;
            let client_name: Option<String> = row.get(7)?;
            let brand: Option<String> = row.get(8)?;
            let model: Option<String> = row.get(9)?;
            Ok(ArchiveItem {
                id,
                item_type: "contract".to_string(),
                title: contract_number.clone(),
                subtitle: client_name.clone(),
                description: Some(format!("Réservation #{reservation_id} | {} {}", brand.clone().unwrap_or_default(), model.clone().unwrap_or_default())),
                archived_at,
                archived_reason,
                status: Some(status.clone()),
                original_data: serde_json::json!({ "id": id, "reservationId": reservation_id, "contractNumber": contract_number, "client": client_name, "car": format!("{} {}", brand.unwrap_or_default(), model.unwrap_or_default()), "status": status, "generatedAt": generated_at }),
            })
        })
        .map_err(|error| error.to_string())?;
    items.extend(
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?,
    );
    Ok(())
}

fn validate_reservation_data(data: &CreateReservationDto) -> Result<(), String> {
    if data.client_id <= 0 {
        return Err("Client obligatoire.".to_string());
    }

    if data.second_client_id == Some(data.client_id) {
        return Err("Le deuxième conducteur doit être différent du client principal.".to_string());
    }

    if data.car_id <= 0 {
        return Err("Voiture obligatoire.".to_string());
    }

    if data.start_date.trim().is_empty() {
        return Err("Date et heure de prise obligatoires.".to_string());
    }

    if data.end_date.trim().is_empty() {
        return Err("Date et heure de retour obligatoires.".to_string());
    }

    let start_minutes =
        parse_iso_minutes(&data.start_date).ok_or("Date de début invalide.".to_string())?;
    let end_minutes =
        parse_iso_minutes(&data.end_date).ok_or("Date de fin invalide.".to_string())?;

    if end_minutes - start_minutes < 24 * 60 {
        return Err("La durée minimale de location est de 24h.".to_string());
    }

    if data.daily_price <= 0.0 {
        return Err("Le prix/jour doit être supérieur à 0.".to_string());
    }

    if data.deposit_amount < 0.0 {
        return Err("La caution doit être supérieure ou égale à 0.".to_string());
    }

    Ok(())
}

fn validate_payment_data(connection: &Connection, data: &CreatePaymentDto) -> Result<(), String> {
    if data.reservation_id <= 0 {
        return Err("Réservation obligatoire.".to_string());
    }

    if data.amount < 0.0 || (data.payment_type != "DEPOSIT_REFUND" && data.amount <= 0.0) {
        return Err(if data.payment_type == "DEPOSIT_REFUND" {
            "Le montant à rembourser doit être supérieur ou égal à 0.".to_string()
        } else {
            "Le montant doit être supérieur à 0.".to_string()
        });
    }

    let (total_price, deposit_amount): (f64, f64) = connection
        .query_row(
            "SELECT totalPrice, depositAmount FROM Reservation WHERE id = ?1 AND (archived = 0 OR archived IS NULL)",
            params![data.reservation_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Réservation introuvable.".to_string())?;

    let rental_paid = sum_payments(connection, data.reservation_id, "RENTAL_PAYMENT")?;
    let rental_remaining = (total_price - rental_paid).max(0.0);
    let deposit_paid = sum_payments(connection, data.reservation_id, "DEPOSIT")?;
    let deposit_refunded = sum_payments(connection, data.reservation_id, "DEPOSIT_REFUND")?;
    let deposit_refund_decided =
        count_payments(connection, data.reservation_id, "DEPOSIT_REFUND")? > 0;
    let refundable_deposit = if deposit_paid > 0.0 {
        if deposit_amount > 0.0 {
            deposit_paid.min(deposit_amount)
        } else {
            deposit_paid
        }
    } else {
        0.0
    };
    let deposit_available = (refundable_deposit - deposit_refunded).max(0.0);

    match data.payment_type.as_str() {
        "RENTAL_PAYMENT" if data.amount > rental_remaining => Err(format!(
            "Le paiement location ne peut pas dépasser {} DT.",
            rental_remaining
        )),
        "RENTAL_PAYMENT" if rental_remaining <= 0.0 => {
            Err("La location est déjà totalement payée.".to_string())
        }
        "DEPOSIT" if deposit_amount <= 0.0 => {
            Err("Aucune caution n'est prévue pour cette réservation.".to_string())
        }
        "DEPOSIT" if deposit_paid > 0.0 => {
            Err("La caution est déjà encaissée pour cette réservation.".to_string())
        }
        "DEPOSIT" if !amounts_are_equal(data.amount, deposit_amount) => Err(format!(
            "La caution doit être payée en une seule fois : {} DT.",
            deposit_amount
        )),
        "DEPOSIT_REFUND" if deposit_refund_decided => Err(
            "Le remboursement de caution est déjà enregistré pour cette réservation.".to_string(),
        ),
        "DEPOSIT_REFUND" if data.amount > deposit_available => Err(format!(
            "Le remboursement ne peut pas dépasser {} DT.",
            deposit_available
        )),
        _ => Ok(()),
    }
}

fn sum_payments(
    connection: &Connection,
    reservation_id: i32,
    payment_type: &str,
) -> Result<f64, String> {
    connection
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM Payment WHERE reservationId = ?1 AND type = ?2",
            params![reservation_id, payment_type],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())
}

fn count_payments(
    connection: &Connection,
    reservation_id: i32,
    payment_type: &str,
) -> Result<i64, String> {
    connection
        .query_row(
            "SELECT COUNT(*) FROM Payment WHERE reservationId = ?1 AND type = ?2",
            params![reservation_id, payment_type],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())
}

fn amounts_are_equal(first: f64, second: f64) -> bool {
    (first - second).abs() < 0.001
}

fn ensure_client_active(
    connection: &Connection,
    client_id: i32,
    label: &str,
) -> Result<(), String> {
    let is_active: bool = connection
        .query_row(
            "SELECT isActive FROM Client WHERE id = ?1 AND (archived = 0 OR archived IS NULL)",
            params![client_id],
            |row| row.get(0),
        )
        .map_err(|_| format!("{} introuvable.", label))?;

    if !is_active {
        return Err(format!("{} désactivé.", label));
    }

    Ok(())
}

fn has_reservation_conflict(
    connection: &Connection,
    car_id: i32,
    start_date: &str,
    end_date: &str,
    excluded_id: Option<i32>,
) -> Result<bool, String> {
    let overlapping_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM Reservation
             WHERE carId = ?1
               AND (?4 IS NULL OR id != ?4)
               AND (archived = 0 OR archived IS NULL)
               AND status IN ('EN_ATTENTE', 'RESERVED', 'ONGOING')
               AND (CASE WHEN length(startDate) = 10 THEN startDate || 'T00:00:00.000Z' ELSE startDate END) < ?3
               AND (CASE WHEN length(endDate) = 10 THEN endDate || 'T23:59:59.999Z' ELSE endDate END) > ?2",
            params![car_id, start_date, end_date, excluded_id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;

    Ok(overlapping_count > 0)
}

fn parse_iso_minutes(value: &str) -> Option<i64> {
    let value = value.trim();
    let date_part = value.get(0..10)?;
    let time_part = if value.len() >= 16 {
        value.get(11..16).unwrap_or("00:00")
    } else {
        "00:00"
    };
    let mut date = date_part.split('-');
    let year: i32 = date.next()?.parse().ok()?;
    let month: u32 = date.next()?.parse().ok()?;
    let day: u32 = date.next()?.parse().ok()?;
    let mut time = time_part.split(':');
    let hour: i64 = time.next()?.parse().ok()?;
    let minute: i64 = time.next()?.parse().ok()?;
    Some(days_from_civil(year, month, day) * 24 * 60 + hour * 60 + minute)
}

fn days_from_civil(year: i32, month: u32, day: u32) -> i64 {
    let year = year - if month <= 2 { 1 } else { 0 };
    let era = if year >= 0 { year } else { year - 399 } / 400;
    let yoe = year - era * 400;
    let month = month as i32;
    let day = day as i32;
    let doy = (153 * (month + if month > 2 { -3 } else { 9 }) + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    (era * 146097 + doe - 719468) as i64
}

fn map_client_db_error(error: rusqlite::Error) -> String {
    let message = error.to_string();
    if message.contains("Client.phone") {
        return "Ce téléphone existe déjà.".to_string();
    }
    if message.contains("Client.cin") {
        return "Cette CIN existe déjà.".to_string();
    }
    if message.contains("Client.passportNumber") {
        return "Ce passeport existe déjà.".to_string();
    }
    if message.contains("Client.drivingLicense") {
        return "Ce numéro de permis existe déjà.".to_string();
    }
    message
}

fn map_user_db_error(error: rusqlite::Error) -> String {
    let message = error.to_string();
    if message.contains("User.username") {
        return "Ce nom d'utilisateur existe déjà.".to_string();
    }
    message
}

// ----- AI / ML offline integration -----

fn project_root() -> Result<PathBuf, String> {
    let current_dir = std::env::current_dir().map_err(|error| error.to_string())?;
    if current_dir.file_name().and_then(|name| name.to_str()) == Some("src-tauri") {
        current_dir
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| "Impossible de résoudre le dossier projet".to_string())
    } else {
        Ok(current_dir)
    }
}

fn resolve_models_dir(model_path: Option<String>) -> Result<PathBuf, String> {
    let root = project_root()?;
    let raw = model_path
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "ml/models".to_string());
    let candidate = PathBuf::from(&raw);
    let absolute = if candidate.is_absolute() {
        candidate
    } else {
        root.join(candidate)
    };
    Ok(absolute)
}

fn resolve_python_executable(python_path: Option<String>) -> Option<String> {
    if let Some(path) = python_path {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }
    let candidates = if cfg!(target_os = "windows") {
        vec!["python", "python3", "py"]
    } else {
        vec!["python3", "python"]
    };
    for candidate in candidates {
        if Command::new(candidate).arg("--version").output().is_ok() {
            return Some(candidate.to_string());
        }
    }
    None
}

fn run_python_script(
    python_path: Option<String>,
    script_relative: &str,
    extra_args: &[(&str, String)],
) -> Result<String, String> {
    let python = resolve_python_executable(python_path).ok_or_else(|| {
        "Python n'est pas disponible sur cette machine. Installez Python ou configurez le chemin Python dans les paramètres.".to_string()
    })?;

    let root = project_root()?;
    let script = root.join(script_relative);
    if !script.exists() {
        return Err(format!("Script Python introuvable : {}", script.display()));
    }

    let db = db_path()?;
    let mut command = Command::new(&python);
    command.arg(&script).arg("--db").arg(&db);
    for (flag, value) in extra_args {
        command.arg(flag).arg(value);
    }

    let output = command
        .output()
        .map_err(|error| format!("Erreur exécution Python : {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Le script Python a échoué : {}", stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    Ok(stdout)
}

fn parse_json_stdout(stdout: &str) -> Result<JsonValue, String> {
    let trimmed = stdout.trim();
    if trimmed.is_empty() {
        return Err("Sortie Python vide.".to_string());
    }
    let last_line = trimmed.lines().last().unwrap_or(trimmed).trim();
    serde_json::from_str::<JsonValue>(last_line)
        .or_else(|_| serde_json::from_str::<JsonValue>(trimmed))
        .map_err(|error| format!("Réponse Python invalide : {error}"))
}

fn execution_error_value(message: &str) -> JsonValue {
    serde_json::json!({
        "success": false,
        "reason": "EXECUTION_ERROR",
        "message": message,
    })
}

fn python_missing_value() -> JsonValue {
    serde_json::json!({
        "success": false,
        "reason": "PYTHON_NOT_FOUND",
        "message": "Python n'est pas disponible sur cette machine. Installez Python ou configurez le chemin Python dans les paramètres.",
    })
}

#[tauri::command]
fn train_ai_models(
    state: tauri::State<'_, AppState>,
    python_path: Option<String>,
    model_path: Option<String>,
    min_reservations: Option<i64>,
) -> Result<JsonValue, String> {
    let _ = require_authenticated(&state)?;
    let models_dir = resolve_models_dir(model_path)?;
    fs::create_dir_all(&models_dir).map_err(|error| error.to_string())?;
    let min_reservations_value = min_reservations.unwrap_or(30).to_string();

    if resolve_python_executable(python_path.clone()).is_none() {
        return Ok(python_missing_value());
    }

    let extra_args = vec![
        ("--models", models_dir.to_string_lossy().to_string()),
        ("--min-reservations", min_reservations_value),
    ];

    match run_python_script(python_path, "ml/train_model.py", &extra_args) {
        Ok(stdout) => parse_json_stdout(&stdout).or_else(|error| Ok(execution_error_value(&error))),
        Err(error) => Ok(execution_error_value(&error)),
    }
}

#[tauri::command]
fn run_ai_forecast(
    state: tauri::State<'_, AppState>,
    python_path: Option<String>,
    model_path: Option<String>,
) -> Result<JsonValue, String> {
    let _ = require_authenticated(&state)?;
    let models_dir = resolve_models_dir(model_path)?;

    if !models_dir.join("revenue_model.pkl").exists()
        || !models_dir.join("demand_model.pkl").exists()
    {
        return Ok(serde_json::json!({
            "success": false,
            "reason": "INSUFFICIENT_DATA",
            "message": "Modèles non entraînés. Lancez d'abord l'entraînement.",
        }));
    }

    if resolve_python_executable(python_path.clone()).is_none() {
        return Ok(python_missing_value());
    }

    let extra_args = vec![("--models", models_dir.to_string_lossy().to_string())];

    match run_python_script(python_path, "ml/predict.py", &extra_args) {
        Ok(stdout) => parse_json_stdout(&stdout).or_else(|error| Ok(execution_error_value(&error))),
        Err(error) => Ok(execution_error_value(&error)),
    }
}

#[tauri::command]
fn get_ai_model_status(
    state: tauri::State<'_, AppState>,
    python_path: Option<String>,
    model_path: Option<String>,
) -> Result<JsonValue, String> {
    let _ = require_authenticated(&state)?;
    let models_dir = resolve_models_dir(model_path)?;
    let expected = [
        "revenue_model.pkl",
        "demand_model.pkl",
        "client_segments.pkl",
    ];

    let mut found = Vec::new();
    let mut last_modified: Option<String> = None;
    for name in expected {
        let path = models_dir.join(name);
        if path.exists() {
            found.push(name.to_string());
            if let Ok(metadata) = fs::metadata(&path) {
                if let Ok(modified) = metadata.modified() {
                    if let Ok(duration) = modified.duration_since(std::time::UNIX_EPOCH) {
                        let secs = duration.as_secs() as i64;
                        let candidate = format_unix_seconds(secs);
                        last_modified = Some(match last_modified {
                            Some(existing) if existing >= candidate => existing,
                            _ => candidate,
                        });
                    }
                }
            }
        }
    }

    let resolved_python = resolve_python_executable(python_path.clone());
    let trained = found.len() >= 2;

    Ok(serde_json::json!({
        "trained": trained,
        "lastTrainedAt": last_modified,
        "modelsFound": found,
        "pythonAvailable": resolved_python.is_some(),
        "pythonPath": resolved_python,
        "message": if resolved_python.is_some() {
            None
        } else {
            Some("Python n'est pas disponible sur cette machine.".to_string())
        },
    }))
}

fn format_unix_seconds(secs: i64) -> String {
    let days = secs.div_euclid(86_400);
    let remainder = secs.rem_euclid(86_400);
    let (year, month, day) = civil_from_days(days);
    let hour = remainder / 3600;
    let minute = (remainder % 3600) / 60;
    let second = remainder % 60;
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}",
        year, month, day, hour, minute, second
    )
}

fn unix_now_seconds() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

fn iso_days_ago(days_ago: i64) -> String {
    format!(
        "{}T00:00:00Z",
        format_unix_seconds(unix_now_seconds() - days_ago * 86_400)
    )
}

fn iso_datetime_days_ago(days_ago: i64, hour: i64) -> String {
    let hour = hour.clamp(0, 23);
    let secs = unix_now_seconds() - days_ago * 86_400 - (12 - hour) * 3_600;
    format!("{}Z", format_unix_seconds(secs))
}

fn civil_from_days(days: i64) -> (i32, u32, u32) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let year = (y + if m <= 2 { 1 } else { 0 }) as i32;
    (year, m, d)
}

fn main() {
    let db = init_db().expect("failed to initialize local SQLite database");

    tauri::Builder::default()
        .manage(AppState {
            db: Mutex::new(db),
            auth_user: Mutex::new(None),
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_auth_state,
            register_user,
            login_user,
            logout_user,
            save_database_copy,
            mount_existing_database,
            get_cars,
            create_car,
            update_car,
            change_car_status,
            delete_car,
            get_clients,
            create_client,
            update_client,
            delete_client,
            deactivate_client,
            reactivate_client,
            get_reservations,
            create_reservation,
            update_reservation,
            update_reservation_status,
            delete_reservation,
            get_payments,
            create_payment,
            get_contracts,
            generate_contract,
            get_archive_stats,
            get_archived_items,
            archive_item,
            restore_archived_item,
            permanently_delete_archived_item,
            get_dashboard_stats,
            seed_ai_sample_data,
            train_ai_models,
            run_ai_forecast,
            get_ai_model_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
