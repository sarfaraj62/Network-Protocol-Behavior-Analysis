<?php
/**
 * API: PCAP File Upload & Server-side Parser
 *
 * POST /api/pcap_upload.php  – Upload a PCAP/TXT trace file
 * GET  /api/pcap_upload.php  – List uploaded PCAP traces
 * GET  /api/pcap_upload.php?id=ID – Get parsed PCAP trace data
 */

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {

    // ─── UPLOAD ─────────────────────────────────────────────────────────────
    case 'POST':
        if (empty($_FILES['pcap'])) {
            api_error('No file uploaded. Use multipart field "pcap".');
        }

        $file    = $_FILES['pcap'];
        $maxSize = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

        if ($file['error'] !== UPLOAD_ERR_OK) {
            api_error('File upload error: code ' . $file['error']);
        }
        if ($file['size'] > $maxSize) {
            api_error('File too large. Max ' . MAX_UPLOAD_SIZE_MB . ' MB');
        }

        // Validate extension
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ['pcap', 'pcapng', 'txt', 'log', 'csv'])) {
            api_error('Unsupported file type. Allowed: pcap, pcapng, txt, log, csv');
        }

        $storedName = 'pcap_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
        $destPath   = UPLOADS_DIR . '/' . $storedName;

        if (!move_uploaded_file($file['tmp_name'], $destPath)) {
            api_error('Could not save uploaded file', 500);
        }

        // Parse the file
        $parsed = parse_pcap_file($destPath, $ext);

        // Store in DB
        $db   = get_db();
        $stmt = $db->prepare("
            INSERT INTO pcap_uploads (original_name, stored_name, file_path, packet_count, parsed_json)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $file['name'],
            $storedName,
            $destPath,
            count($parsed['packets'] ?? []),
            json_encode($parsed),
        ]);
        $insertId = $db->lastInsertId();

        api_success([
            'id'           => (int)$insertId,
            'filename'     => $file['name'],
            'stored_as'    => $storedName,
            'packet_count' => count($parsed['packets'] ?? []),
            'protocols'    => $parsed['protocols'] ?? [],
            'preview'      => array_slice($parsed['packets'] ?? [], 0, 20),
        ], 201);

    // ─── GET ────────────────────────────────────────────────────────────────
    case 'GET':
        $db = get_db();

        if (!empty($_GET['id'])) {
            $row = $db->prepare("SELECT * FROM pcap_uploads WHERE id = ?");
            $row->execute([(int)$_GET['id']]);
            $pcap = $row->fetch();

            if (!$pcap) api_error('PCAP record not found', 404);

            $parsed = json_decode($pcap['parsed_json'], true) ?? [];
            unset($pcap['parsed_json']);
            $pcap['parsed'] = $parsed;

            api_success(['pcap' => $pcap]);
        }

        $rows = $db->query("
            SELECT id, original_name, stored_name, packet_count, uploaded_at
            FROM pcap_uploads
            ORDER BY uploaded_at DESC
            LIMIT 50
        ")->fetchAll();

        api_success(['pcap_files' => $rows]);

    default:
        api_error('Method Not Allowed', 405);
}

// ─── PCAP / Text Trace Parser ─────────────────────────────────────────────────
function parse_pcap_file(string $path, string $ext): array {
    $packets   = [];
    $protocols = [];
    $idx       = 1;

    // For CSV/TXT/LOG: parse line-by-line as a Wireshark export
    if (in_array($ext, ['txt', 'log', 'csv'])) {
        $handle = fopen($path, 'r');
        if (!$handle) return ['packets' => [], 'protocols' => []];

        $isFirst = true;
        while (($line = fgets($handle)) !== false && $idx <= 2000) {
            $line = trim($line);
            if (empty($line) || str_starts_with($line, '#')) continue;

            // Try CSV Wireshark format: No, Time, Source, Destination, Protocol, Length, Info
            $cols = str_getcsv($line);
            if (count($cols) >= 6) {
                if ($isFirst && !is_numeric($cols[0])) {
                    $isFirst = false;
                    continue; // skip header
                }
                $proto = strtoupper(trim($cols[4] ?? 'TCP'));
                if (!in_array($proto, $protocols)) $protocols[] = $proto;

                $packets[] = [
                    'no'          => (int)($cols[0] ?? $idx),
                    'time'        => (float)($cols[1] ?? 0),
                    'src'         => trim($cols[2] ?? ''),
                    'dst'         => trim($cols[3] ?? ''),
                    'protocol'    => $proto,
                    'length'      => (int)($cols[5] ?? 0),
                    'info'        => trim($cols[6] ?? ''),
                    'hex_preview' => generate_hex_preview($line),
                    'layers'      => build_layers($proto, $cols),
                ];
                $idx++;
            }
            $isFirst = false;
        }
        fclose($handle);
    }

    // Binary PCAP: read global header + packet records
    elseif (in_array($ext, ['pcap', 'pcapng'])) {
        $packets = parse_binary_pcap($path);
        foreach ($packets as $p) {
            if (!in_array($p['protocol'], $protocols)) {
                $protocols[] = $p['protocol'];
            }
        }
    }

    return [
        'packets'   => $packets,
        'protocols' => $protocols,
        'total'     => count($packets),
    ];
}

function parse_binary_pcap(string $path): array {
    $packets = [];
    $fh      = fopen($path, 'rb');
    if (!$fh) return $packets;

    // Read global header (24 bytes)
    $globalHeader = fread($fh, 24);
    if (strlen($globalHeader) < 24) { fclose($fh); return $packets; }

    $magic = unpack('N', substr($globalHeader, 0, 4))[1];
    $le    = ($magic === 0xa1b2c3d4); // little-endian?

    $idx     = 1;
    $baseTs  = null;

    while (!feof($fh) && $idx <= 1000) {
        $hdr = fread($fh, 16);
        if (strlen($hdr) < 16) break;

        if ($le) {
            [$tsSec, $tsUsec, $inclLen, $origLen] = array_values(unpack('V4', $hdr));
        } else {
            [$tsSec, $tsUsec, $inclLen, $origLen] = array_values(unpack('N4', $hdr));
        }

        if ($baseTs === null) $baseTs = $tsSec;
        $timeSec = ($tsSec - $baseTs) + $tsUsec / 1e6;

        // Read packet data (cap at 65535)
        $inclLen = min($inclLen, 65535);
        $data    = fread($fh, $inclLen);

        // Parse Ethernet → IP → Transport
        $parsed = dissect_ethernet($data ?? '');

        $packets[] = array_merge($parsed, [
            'no'       => $idx,
            'time'     => round($timeSec, 6),
            'length'   => $origLen,
            'hex_preview' => bin2hex(substr($data, 0, 32)),
        ]);
        $idx++;
    }
    fclose($fh);
    return $packets;
}

function dissect_ethernet(string $data): array {
    $result = ['src' => '', 'dst' => '', 'protocol' => 'ETH', 'info' => '', 'layers' => []];
    if (strlen($data) < 14) return $result;

    $dst = implode(':', array_map(fn($b) => sprintf('%02x', $b), array_values(unpack('C*', substr($data, 0, 6)))));
    $src = implode(':', array_map(fn($b) => sprintf('%02x', $b), array_values(unpack('C*', substr($data, 6, 6)))));
    $ethertype = unpack('n', substr($data, 12, 2))[1];

    $result['src'] = $src;
    $result['dst'] = $dst;

    if ($ethertype === 0x0800) { // IPv4
        $ip = dissect_ipv4(substr($data, 14));
        $result = array_merge($result, $ip);
    } elseif ($ethertype === 0x0806) {
        $result['protocol'] = 'ARP';
        $result['info']     = 'ARP Request/Reply';
    } elseif ($ethertype === 0x86DD) {
        $result['protocol'] = 'IPv6';
        $result['info']     = 'IPv6 Packet';
    }

    return $result;
}

function dissect_ipv4(string $data): array {
    $result = ['src' => '', 'dst' => '', 'protocol' => 'IP', 'info' => '', 'layers' => []];
    if (strlen($data) < 20) return $result;

    $ihl     = (ord($data[0]) & 0x0F) * 4;
    $proto   = ord($data[9]);
    $srcIp   = implode('.', unpack('C4', substr($data, 12, 4)));
    $dstIp   = implode('.', unpack('C4', substr($data, 16, 4)));

    $result['src'] = $srcIp;
    $result['dst'] = $dstIp;
    $result['layers']['ipv4'] = "Version: 4 | IHL: $ihl bytes | Proto: $proto";

    $transport = substr($data, $ihl);
    if ($proto === 6) { // TCP
        return array_merge($result, dissect_tcp($transport, $srcIp, $dstIp));
    } elseif ($proto === 17) { // UDP
        return array_merge($result, dissect_udp($transport, $srcIp, $dstIp));
    } elseif ($proto === 1) {
        $result['protocol'] = 'ICMP';
        $result['info']     = 'ICMP Message';
    }

    return $result;
}

function dissect_tcp(string $data, string $src, string $dst): array {
    if (strlen($data) < 20) return ['protocol' => 'TCP', 'info' => ''];

    $srcPort  = unpack('n', substr($data, 0, 2))[1];
    $dstPort  = unpack('n', substr($data, 2, 2))[1];
    $seqNo    = unpack('N', substr($data, 4, 4))[1];
    $ackNo    = unpack('N', substr($data, 8, 4))[1];
    $flagByte = ord($data[13]);

    $flags = [];
    if ($flagByte & 0x01) $flags[] = 'FIN';
    if ($flagByte & 0x02) $flags[] = 'SYN';
    if ($flagByte & 0x04) $flags[] = 'RST';
    if ($flagByte & 0x08) $flags[] = 'PSH';
    if ($flagByte & 0x10) $flags[] = 'ACK';
    if ($flagByte & 0x20) $flags[] = 'URG';

    $flagStr  = implode(', ', $flags) ?: 'NONE';
    $protocol = 'TCP';

    // Identify well-known ports
    $wellKnown = [80 => 'HTTP', 443 => 'HTTPS', 8080 => 'HTTP-Alt',
                  21 => 'FTP', 22 => 'SSH', 25 => 'SMTP', 53 => 'DNS(TCP)',
                  1883 => 'MQTT', 8883 => 'MQTT-TLS'];
    if (isset($wellKnown[$dstPort])) $protocol = $wellKnown[$dstPort];
    elseif (isset($wellKnown[$srcPort])) $protocol = $wellKnown[$srcPort];

    return [
        'protocol' => $protocol,
        'src'      => "$src:$srcPort",
        'dst'      => "$dst:$dstPort",
        'info'     => "[$flagStr] Seq=$seqNo Ack=$ackNo",
        'layers'   => [
            'tcp' => "SrcPort=$srcPort | DstPort=$dstPort | Flags=[$flagStr] | Seq=$seqNo | Ack=$ackNo",
        ],
    ];
}

function dissect_udp(string $data, string $src, string $dst): array {
    if (strlen($data) < 8) return ['protocol' => 'UDP', 'info' => ''];

    $srcPort = unpack('n', substr($data, 0, 2))[1];
    $dstPort = unpack('n', substr($data, 2, 2))[1];
    $length  = unpack('n', substr($data, 4, 2))[1];
    $protocol = 'UDP';

    $wellKnown = [53 => 'DNS', 67 => 'DHCP', 68 => 'DHCP', 123 => 'NTP',
                  443 => 'QUIC', 4433 => 'QUIC', 5353 => 'mDNS'];
    if (isset($wellKnown[$dstPort])) $protocol = $wellKnown[$dstPort];
    elseif (isset($wellKnown[$srcPort])) $protocol = $wellKnown[$srcPort];

    return [
        'protocol' => $protocol,
        'src'      => "$src:$srcPort",
        'dst'      => "$dst:$dstPort",
        'info'     => "Len=$length",
        'layers'   => [
            'udp' => "SrcPort=$srcPort | DstPort=$dstPort | Length=$length",
        ],
    ];
}

function build_layers(string $proto, array $cols): array {
    $layers = ['ethernet' => 'Ethernet II'];
    $info = $cols[6] ?? '';

    if (in_array($proto, ['TCP', 'HTTP', 'HTTPS', 'TLS', 'MQTT'])) {
        $layers['ipv4'] = 'Internet Protocol Version 4';
        $layers['tcp']  = "TCP | Info: $info";
    } elseif (in_array($proto, ['UDP', 'DNS', 'QUIC', 'NTP', 'MDNS'])) {
        $layers['ipv4'] = 'Internet Protocol Version 4';
        $layers['udp']  = "UDP | Info: $info";
    } else {
        $layers['transport'] = $info;
    }

    return $layers;
}

function generate_hex_preview(string $text): string {
    $raw = substr($text, 0, 32);
    return implode(' ', str_split(bin2hex($raw), 2));
}
