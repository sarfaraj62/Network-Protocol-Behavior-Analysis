<?php
/**
 * API: Dashboard Statistics Endpoint
 * GET /api/stats.php – Returns aggregate stats for all sessions
 */

require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    api_error('Method Not Allowed', 405);
}

$db = get_db();

// ─── Aggregate Stats ──────────────────────────────────────────────────────────
$totalSessions  = (int)$db->query("SELECT COUNT(*) FROM simulation_sessions")->fetchColumn();
$totalLogs      = (int)$db->query("SELECT COUNT(*) FROM packet_logs")->fetchColumn();
$totalReports   = (int)$db->query("SELECT COUNT(*) FROM saved_reports")->fetchColumn();
$totalPcaps     = (int)$db->query("SELECT COUNT(*) FROM pcap_uploads")->fetchColumn();

// Protocol distribution
$protoDist = $db->query("
    SELECT protocol, COUNT(*) as count
    FROM simulation_sessions
    GROUP BY protocol
    ORDER BY count DESC
")->fetchAll();

// Application distribution
$appDist = $db->query("
    SELECT application, COUNT(*) as count
    FROM simulation_sessions
    GROUP BY application
    ORDER BY count DESC
")->fetchAll();

// Average metrics
$avgMetrics = $db->query("
    SELECT
        ROUND(AVG(loss_rate), 2)  AS avg_loss_rate,
        ROUND(AVG(base_rtt), 1)   AS avg_rtt,
        ROUND(AVG(jitter), 1)     AS avg_jitter
    FROM simulation_sessions
")->fetch();

// Recent 5 sessions
$recentSessions = $db->query("
    SELECT session_uid, protocol, application, loss_rate, base_rtt, updated_at
    FROM simulation_sessions
    ORDER BY updated_at DESC
    LIMIT 5
")->fetchAll();

// Severity breakdown of packet logs
$severityBreakdown = $db->query("
    SELECT severity, COUNT(*) as count
    FROM packet_logs
    GROUP BY severity
    ORDER BY count DESC
")->fetchAll();

api_success([
    'overview' => [
        'total_sessions' => $totalSessions,
        'total_log_events' => $totalLogs,
        'total_reports' => $totalReports,
        'total_pcap_files' => $totalPcaps,
    ],
    'protocol_distribution' => $protoDist,
    'application_distribution' => $appDist,
    'average_metrics' => $avgMetrics,
    'recent_sessions' => $recentSessions,
    'severity_breakdown' => $severityBreakdown,
    'generated_at' => date('c'),
]);
