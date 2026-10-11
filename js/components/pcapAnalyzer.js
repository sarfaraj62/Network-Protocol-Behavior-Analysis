/**
 * Extended PCAP Trace Analyzer & Interactive Custom Packet Crafter
 */

export const SAMPLE_TRACES = {
    web_tcp: {
        name: 'Web Browsing (TCP / HTTP/1.1 3-Way Handshake)',
        packets: [
            { no: 1, time: '0.000000', src: '192.168.1.105', dst: '104.16.123.96', proto: 'TCP', len: 74, flags: '[SYN]', seq: 0, ack: 0, win: 64240, info: '54322 → 443 [SYN] Seq=0 Win=64240 Len=0 MSS=1460' },
            { no: 2, time: '0.042180', src: '104.16.123.96', dst: '192.168.1.105', proto: 'TCP', len: 74, flags: '[SYN, ACK]', seq: 0, ack: 1, win: 65535, info: '443 → 54322 [SYN, ACK] Seq=0 Ack=1 Win=65535 Len=0' },
            { no: 3, time: '0.042510', src: '192.168.1.105', dst: '104.16.123.96', proto: 'TCP', len: 66, flags: '[ACK]', seq: 1, ack: 1, win: 64240, info: '54322 → 443 [ACK] Seq=1 Ack=1 Win=64240 Len=0' },
            { no: 4, time: '0.045110', src: '192.168.1.105', dst: '104.16.123.96', proto: 'HTTP', len: 532, flags: '[PSH, ACK]', seq: 1, ack: 1, win: 64240, info: 'GET /index.html HTTP/1.1 (application/json)' },
            { no: 5, time: '0.088230', src: '104.16.123.96', dst: '192.168.1.105', proto: 'TCP', len: 1514, flags: '[ACK]', seq: 1, ack: 467, win: 65535, info: 'HTTP/1.1 200 OK (text/html) [TCP segment of a reassembled PDU]' },
            { no: 6, time: '0.088310', src: '104.16.123.96', dst: '192.168.1.105', proto: 'HTTP', len: 1420, flags: '[PSH, ACK]', seq: 1449, ack: 467, win: 65535, info: 'Continuation data (chunk 2 of 2)' }
        ]
    },
    streaming_udp: {
        name: 'Real-Time Video Stream (UDP Datagrams)',
        packets: [
            { no: 1, time: '0.000000', src: '192.168.1.105', dst: '34.210.12.80', proto: 'UDP', len: 1250, flags: 'None', seq: 'N/A', ack: 'N/A', win: 'N/A', info: 'Len=1208 RTP Payload: Video H.264 Chunk #101' },
            { no: 2, time: '0.008320', src: '192.168.1.105', dst: '34.210.12.80', proto: 'UDP', len: 1250, flags: 'None', seq: 'N/A', ack: 'N/A', win: 'N/A', info: 'Len=1208 RTP Payload: Video H.264 Chunk #102' },
            { no: 3, time: '0.016640', src: '192.168.1.105', dst: '34.210.12.80', proto: 'UDP', len: 1250, flags: 'None', seq: 'N/A', ack: 'N/A', win: 'N/A', info: 'Len=1208 RTP Payload: Video H.264 Chunk #103 [DROPPED BY ROUTER]' },
            { no: 4, time: '0.024960', src: '192.168.1.105', dst: '34.210.12.80', proto: 'UDP', len: 1250, flags: 'None', seq: 'N/A', ack: 'N/A', win: 'N/A', info: 'Len=1208 RTP Payload: Video H.264 Chunk #104 (Continued smoothly without stall)' }
        ]
    },
    quic_http3: {
        name: 'QUIC / HTTP/3 0-RTT Stream Multiplexing',
        packets: [
            { no: 1, time: '0.000000', src: '192.168.1.105', dst: '142.250.190.46', proto: 'QUIC', len: 1200, flags: 'Initial', seq: 0, ack: 'N/A', win: 'N/A', info: 'Initial, DCID=8f7a91, Crypto (ClientHello, TLS 1.3 0-RTT)' },
            { no: 2, time: '0.018240', src: '142.250.190.46', dst: '192.168.1.105', proto: 'QUIC', len: 1250, flags: 'Handshake', seq: 0, ack: 0, win: 'N/A', info: 'Handshake, SCID=990b12, Crypto (ServerHello, EE, CERT, FIN)' },
            { no: 3, time: '0.018910', src: '192.168.1.105', dst: '142.250.190.46', proto: 'HTTP3', len: 450, flags: 'Short Header', seq: 1, ack: 0, win: 'N/A', info: 'Stream: 0 (HEADERS), Stream: 4 (DATA - CSS asset)' }
        ]
    },
    mqtt_telemetry: {
        name: 'MQTT IoT Sensor Telemetry (QoS 1 Ack Flow)',
        packets: [
            { no: 1, time: '0.000000', src: '192.168.1.50', dst: '172.16.0.10', proto: 'MQTT', len: 85, flags: '[PSH, ACK]', seq: 10, ack: 5, win: 64240, info: 'Publish Message [topic: sensor/temp/zone1, QoS: 1, PacketID: 42]' },
            { no: 2, time: '0.024100', src: '172.16.0.10', dst: '192.168.1.50', proto: 'MQTT', len: 68, flags: '[ACK]', seq: 5, ack: 29, win: 65535, info: 'PubAck [PacketID: 42 - Sensor reading acknowledged]' }
        ]
    }
};

export class PcapAnalyzer {
    constructor() {
        this.currentTrace = SAMPLE_TRACES.web_tcp;
        this.selectedPacket = null;
    }

    init() {
        this.renderTraceList();
        this.loadTrace('web_tcp');
        this.bindPacketCrafter();
    }

    renderTraceList() {
        const traceSelect = document.getElementById('pcapSelect');
        if (!traceSelect) return;

        traceSelect.innerHTML = '';
        Object.keys(SAMPLE_TRACES).forEach(key => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = SAMPLE_TRACES[key].name;
            traceSelect.appendChild(opt);
        });

        traceSelect.addEventListener('change', (e) => this.loadTrace(e.target.value));
    }

    loadTrace(key) {
        this.currentTrace = SAMPLE_TRACES[key] || SAMPLE_TRACES.web_tcp;
        this.selectedPacket = this.currentTrace.packets[0];

        this.renderTable();
        this.renderDetails();
    }

    renderTable() {
        const tbody = document.getElementById('pcapTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';
        this.currentTrace.packets.forEach(pkt => {
            const tr = document.createElement('tr');
            tr.className = `log-row cursor-pointer ${this.selectedPacket && this.selectedPacket.no === pkt.no ? 'bg-cyan-950/40 border-cyan-500/50' : ''}`;
            tr.innerHTML = `
                <td>#${pkt.no}</td>
                <td>${pkt.time}s</td>
                <td class="text-cyan-400">${pkt.src} → ${pkt.dst}</td>
                <td><span class="badge ${this.getBadgeClass(pkt.proto)}">${pkt.proto}</span></td>
                <td>${pkt.len} B</td>
                <td class="text-slate-300 truncate">${pkt.info}</td>
            `;

            tr.addEventListener('click', () => {
                this.selectedPacket = pkt;
                this.renderTable();
                this.renderDetails();
            });

            tbody.appendChild(tr);
        });
    }

    renderDetails() {
        const detailsEl = document.getElementById('pcapDetailsPane');
        const hexEl = document.getElementById('pcapHexPane');
        if (!detailsEl || !this.selectedPacket) return;

        const pkt = this.selectedPacket;

        detailsEl.innerHTML = `
            <div class="space-y-3 font-mono text-xs">
                <div class="border-b border-slate-700/60 pb-2">
                    <span class="text-slate-400">Frame ${pkt.no}:</span> ${pkt.len} bytes on wire (${pkt.len * 8} bits)
                </div>
                <div class="border-b border-slate-700/60 pb-2">
                    <span class="text-purple-400">Ethernet II:</span> Src: 00:1a:2b:3c:4d:5e, Dst: 00:11:22:33:44:55
                </div>
                <div class="border-b border-slate-700/60 pb-2">
                    <span class="text-cyan-400">Internet Protocol Version 4:</span> Src: ${pkt.src}, Dst: ${pkt.dst}, TTL: 64, Header Len: 20
                </div>
                <div class="border-b border-slate-700/60 pb-2">
                    <span class="text-emerald-400">${pkt.proto} Protocol:</span> Flags: ${pkt.flags}, Seq: ${pkt.seq}, Ack: ${pkt.ack}, Window: ${pkt.win}
                </div>
                <div class="text-amber-300">
                    <span>Application Payload:</span> ${pkt.info}
                </div>
            </div>
        `;

        if (hexEl) {
            hexEl.innerHTML = `
                <pre class="font-mono text-xs text-slate-400 leading-relaxed">
0000   00 11 22 33 44 55 00 1a  2b 3c 4d 5e 08 00 45 00   .."3DU..+<M^..E.
0010   00 4a 4e b2 40 00 40 06  bd 12 c0 a8 01 69 68 10   .JN.@.@......ih.
0020   7b 60 d4 32 01 bb d5 84  0e d2 00 00 00 00 80 02   {\`.2............
0030   fa f0 a8 cd 00 00 02 04  05 b4 01 03 03 08 01 01   ................
                </pre>
            `;
        }
    }

    bindPacketCrafter() {
        const btnCraft = document.getElementById('btnCraftPacket');
        if (!btnCraft) return;

        btnCraft.addEventListener('click', () => {
            const proto = document.getElementById('craftProto').value;
            const src = document.getElementById('craftSrc').value || '192.168.1.100';
            const dst = document.getElementById('craftDst').value || '10.0.0.1';
            const payload = document.getElementById('craftPayload').value || 'GET /api/telemetry HTTP/1.1';
            const flags = document.getElementById('craftFlags').value || '[PSH, ACK]';

            const newPkt = {
                no: this.currentTrace.packets.length + 1,
                time: (Math.random() * 2 + 1).toFixed(6),
                src,
                dst,
                proto,
                len: payload.length + (proto === 'UDP' ? 28 : 40),
                flags,
                seq: Math.floor(Math.random() * 10000),
                ack: Math.floor(Math.random() * 10000),
                win: 64240,
                info: payload
            };

            this.currentTrace.packets.push(newPkt);
            this.selectedPacket = newPkt;
            this.renderTable();
            this.renderDetails();
        });
    }

    getBadgeClass(proto) {
        if (proto === 'TCP' || proto === 'HTTP') return 'badge-cyan';
        if (proto === 'UDP') return 'badge-rose';
        if (proto === 'QUIC' || proto === 'HTTP3') return 'badge-amber';
        return 'badge-emerald';
    }
}
