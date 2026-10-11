<?php
/**
 * Network Protocol Analyzer - Backend Configuration
 */

define('APP_NAME', 'Network Protocol Analyzer');
define('APP_VERSION', '2.0.0');
define('BASE_DIR', dirname(__DIR__));

// ─── Data Storage (SQLite - no MySQL required) ────────────────────────────────
define('DB_PATH', BASE_DIR . '/data/analyzer.db');
define('UPLOADS_DIR', BASE_DIR . '/data/uploads');
define('REPORTS_DIR', BASE_DIR . '/data/reports');
define('LOGS_DIR', BASE_DIR . '/data/logs');

// ─── Allowed Origins (CORS) ────────────────────────────────────────────────────
define('ALLOWED_ORIGIN', '*');

// ─── Rate Limiting ─────────────────────────────────────────────────────────────
define('MAX_UPLOAD_SIZE_MB', 10);

// ─── Initialize directories ────────────────────────────────────────────────────
foreach ([dirname(DB_PATH), UPLOADS_DIR, REPORTS_DIR, LOGS_DIR] as $dir) {
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
}

// ─── CORS Headers ─────────────────────────────────────────────────────────────
header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ─── Error handling ────────────────────────────────────────────────────────────
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    api_error("PHP Error [$errno]: $errstr in $errfile:$errline", 500);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function api_success(array $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode(['status' => 'ok', 'data' => $data], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

function api_error(string $message, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['status' => 'error', 'message' => $message], JSON_PRETTY_PRINT);
    exit;
}

function get_db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO('sqlite:' . DB_PATH);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        init_schema($pdo);
    }
    return $pdo;
}

function init_schema(PDO $pdo): void {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS simulation_sessions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            session_uid TEXT NOT NULL UNIQUE,
            protocol    TEXT NOT NULL,
            application TEXT NOT NULL,
            topology    TEXT NOT NULL,
            congestion  TEXT NOT NULL,
            queue_policy TEXT NOT NULL,
            loss_rate   REAL NOT NULL,
            base_rtt    INTEGER NOT NULL,
            jitter      INTEGER NOT NULL,
            metrics_json TEXT,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS packet_logs (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            session_uid TEXT NOT NULL,
            time_sec    REAL NOT NULL,
            severity    TEXT NOT NULL,
            title       TEXT NOT NULL,
            details     TEXT,
            seq_no      INTEGER,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_uid) REFERENCES simulation_sessions(session_uid) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS saved_reports (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            session_uid TEXT NOT NULL,
            report_type TEXT NOT NULL,
            filename    TEXT NOT NULL,
            file_path   TEXT NOT NULL,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS pcap_uploads (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            original_name TEXT NOT NULL,
            stored_name   TEXT NOT NULL,
            file_path     TEXT NOT NULL,
            packet_count  INTEGER DEFAULT 0,
            parsed_json   TEXT,
            uploaded_at   DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_uid ON simulation_sessions(session_uid);
        CREATE INDEX IF NOT EXISTS idx_logs_session ON packet_logs(session_uid);
    ");
}
