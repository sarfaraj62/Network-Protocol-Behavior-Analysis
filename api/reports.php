<?php
/**
 * API: Save & Retrieve Analysis Reports
 *
 * POST /api/reports.php  – Save a report (CSV or JSON) to the server
 * GET  /api/reports.php  – List saved reports
 * GET  /api/reports.php?download=filename – Download a report
 */

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {

    // ─── SAVE REPORT ────────────────────────────────────────────────────────
    case 'POST':
        $body = json_decode(file_get_contents('php://input'), true);
        if (!$body) api_error('Invalid JSON body');

        $type    = $body['type']        ?? 'json';   // 'csv' | 'json'
        $uid     = $body['session_uid'] ?? 'unknown';
        $content = $body['content']     ?? '';

        if (empty($content)) api_error('Empty report content');

        // Sanitize filename
        $ext      = ($type === 'csv') ? 'csv' : 'json';
        $filename = 'report_' . preg_replace('/[^a-z0-9_-]/i', '_', $uid) . '_' . date('Ymd_His') . '.' . $ext;
        $filepath = REPORTS_DIR . '/' . $filename;

        if (file_put_contents($filepath, $content) === false) {
            api_error('Failed to write report to disk', 500);
        }

        // Record in DB
        $db   = get_db();
        $stmt = $db->prepare("
            INSERT INTO saved_reports (session_uid, report_type, filename, file_path)
            VALUES (?, ?, ?, ?)
        ");
        $stmt->execute([$uid, $type, $filename, $filepath]);

        api_success([
            'filename'    => $filename,
            'report_type' => $type,
            'message'     => 'Report saved to server',
        ]);

    // ─── LIST / DOWNLOAD ────────────────────────────────────────────────────
    case 'GET':
        // Download specific file
        if (!empty($_GET['download'])) {
            $filename = basename($_GET['download']);
            $path     = REPORTS_DIR . '/' . $filename;

            if (!file_exists($path)) api_error('Report file not found', 404);

            // Override content-type for download
            $ext  = pathinfo($path, PATHINFO_EXTENSION);
            $mime = ($ext === 'csv') ? 'text/csv' : 'application/json';

            header('Content-Type: ' . $mime);
            header('Content-Disposition: attachment; filename="' . $filename . '"');
            header('Content-Length: ' . filesize($path));
            readfile($path);
            exit;
        }

        // List reports
        $db   = get_db();
        $rows = $db->query("
            SELECT id, session_uid, report_type, filename, created_at
            FROM saved_reports
            ORDER BY created_at DESC
            LIMIT 100
        ")->fetchAll();

        api_success(['reports' => $rows]);

    default:
        api_error('Method Not Allowed', 405);
}
