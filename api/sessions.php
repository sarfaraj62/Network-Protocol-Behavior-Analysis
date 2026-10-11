<?php
/**
 * API: Simulation Session Management
 * 
 * POST /api/sessions.php          – Create / update a session
 * GET  /api/sessions.php          – List all sessions
 * GET  /api/sessions.php?id=UID   – Get one session with its packet logs
 * DELETE /api/sessions.php?id=UID – Delete a session
 */

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {

    // ─── CREATE / UPDATE SESSION ────────────────────────────────────────────
    case 'POST':
        $body = json_decode(file_get_contents('php://input'), true);
        if (!$body) api_error('Invalid JSON body');

        $uid     = $body['session_uid'] ?? bin2hex(random_bytes(8));
        $proto   = $body['protocol']    ?? 'tcp';
        $app     = $body['application'] ?? 'web_browsing';
        $topo    = $body['topology']    ?? 'standard';
        $cong    = $body['congestion']  ?? 'cubic';
        $queue   = $body['queue_policy']?? 'droptail';
        $loss    = (float)($body['loss_rate'] ?? 2.0);
        $rtt     = (int)($body['base_rtt']   ?? 50);
        $jitter  = (int)($body['jitter']     ?? 5);
        $metrics = isset($body['metrics']) ? json_encode($body['metrics']) : null;
        $logs    = $body['packet_logs'] ?? [];

        $db = get_db();

        // Upsert session
        $stmt = $db->prepare("
            INSERT INTO simulation_sessions
                (session_uid, protocol, application, topology, congestion, queue_policy,
                 loss_rate, base_rtt, jitter, metrics_json, updated_at)
            VALUES
                (:uid, :proto, :app, :topo, :cong, :queue,
                 :loss, :rtt, :jitter, :metrics, CURRENT_TIMESTAMP)
            ON CONFLICT(session_uid) DO UPDATE SET
                protocol     = excluded.protocol,
                application  = excluded.application,
                topology     = excluded.topology,
                congestion   = excluded.congestion,
                queue_policy = excluded.queue_policy,
                loss_rate    = excluded.loss_rate,
                base_rtt     = excluded.base_rtt,
                jitter       = excluded.jitter,
                metrics_json = excluded.metrics_json,
                updated_at   = CURRENT_TIMESTAMP
        ");
        $stmt->execute([
            ':uid'     => $uid,
            ':proto'   => $proto,
            ':app'     => $app,
            ':topo'    => $topo,
            ':cong'    => $cong,
            ':queue'   => $queue,
            ':loss'    => $loss,
            ':rtt'     => $rtt,
            ':jitter'  => $jitter,
            ':metrics' => $metrics,
        ]);

        // Insert packet logs batch
        if (!empty($logs)) {
            $ins = $db->prepare("
                INSERT INTO packet_logs (session_uid, time_sec, severity, title, details, seq_no)
                VALUES (:uid, :t, :sev, :title, :det, :seq)
            ");
            foreach ($logs as $log) {
                $ins->execute([
                    ':uid'   => $uid,
                    ':t'     => (float)($log['timeSec']  ?? 0),
                    ':sev'   => $log['severity'] ?? 'INFO',
                    ':title' => $log['title']    ?? '',
                    ':det'   => $log['details']  ?? '',
                    ':seq'   => (int)($log['seqNo'] ?? 0),
                ]);
            }
        }

        api_success(['session_uid' => $uid, 'message' => 'Session saved']);

    // ─── GET SESSION(S) ─────────────────────────────────────────────────────
    case 'GET':
        $db = get_db();

        if (!empty($_GET['id'])) {
            $uid  = $_GET['id'];
            $sess = $db->prepare("SELECT * FROM simulation_sessions WHERE session_uid = ?");
            $sess->execute([$uid]);
            $session = $sess->fetch();

            if (!$session) api_error('Session not found', 404);

            if ($session['metrics_json']) {
                $session['metrics'] = json_decode($session['metrics_json'], true);
            }
            unset($session['metrics_json']);

            $logs = $db->prepare("
                SELECT time_sec, severity, title, details, seq_no
                FROM packet_logs WHERE session_uid = ?
                ORDER BY time_sec ASC
                LIMIT 500
            ");
            $logs->execute([$uid]);
            $session['packet_logs'] = $logs->fetchAll();

            api_success(['session' => $session]);
        }

        // List sessions (paginated)
        $page  = max(1, (int)($_GET['page'] ?? 1));
        $limit = min(100, (int)($_GET['limit'] ?? 20));
        $offset = ($page - 1) * $limit;

        $total = $db->query("SELECT COUNT(*) FROM simulation_sessions")->fetchColumn();
        $rows  = $db->prepare("
            SELECT session_uid, protocol, application, topology, loss_rate, base_rtt,
                   created_at, updated_at
            FROM simulation_sessions
            ORDER BY updated_at DESC
            LIMIT :lim OFFSET :off
        ");
        $rows->bindValue(':lim', $limit, PDO::PARAM_INT);
        $rows->bindValue(':off', $offset, PDO::PARAM_INT);
        $rows->execute();

        api_success([
            'sessions'   => $rows->fetchAll(),
            'total'      => (int)$total,
            'page'       => $page,
            'per_page'   => $limit,
        ]);

    // ─── DELETE ─────────────────────────────────────────────────────────────
    case 'DELETE':
        if (empty($_GET['id'])) api_error('Missing id parameter');
        $uid = $_GET['id'];
        $db  = get_db();
        $stmt = $db->prepare("DELETE FROM simulation_sessions WHERE session_uid = ?");
        $stmt->execute([$uid]);
        if ($stmt->rowCount() === 0) api_error('Session not found', 404);
        api_success(['message' => 'Session deleted']);

    default:
        api_error('Method Not Allowed', 405);
}
