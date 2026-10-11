/**
 * Protocol Deep Dive & Technical Reference Guide Module
 */

export const PROTOCOL_KNOWLEDGE_BASE = [
    {
        id: 'tcp',
        name: 'TCP (Transmission Control Protocol - RFC 793 / RFC 9293)',
        category: 'Transport Layer (Reliable, Connection-Oriented)',
        headerBytes: 20,
        handshake: '3-Way Handshake (SYN → SYN-ACK → ACK)',
        congestionAlg: 'Reno, Cubic, BBR',
        pros: [
            '100% reliable ordered data delivery with sequence numbers and ACKs',
            'Adaptive window scaling & congestion control prevents network collapse',
            'Flow control protects client receiver buffer overflows'
        ],
        cons: [
            'Head-of-Line (HoL) blocking stalls all streams if a single packet is lost',
            '1.5 - 2 RTT latency penalty for initial connection handshake',
            'High header overhead (20 bytes TCP + 20 bytes IPv4)'
        ],
        headerStructure: [
            { field: 'Source Port (16 bits)', desc: 'Port of transmitting application' },
            { field: 'Destination Port (16 bits)', desc: 'Port of receiving server' },
            { field: 'Sequence Number (32 bits)', desc: 'Byte sequence index of payload' },
            { field: 'Acknowledgment Number (32 bits)', desc: 'Next expected byte index' },
            { field: 'Data Offset & Flags (16 bits)', desc: 'SYN, ACK, PSH, RST, FIN, URG' },
            { field: 'Window Size (16 bits)', desc: 'Receiver window buffer space' }
        ]
    },
    {
        id: 'udp',
        name: 'UDP (User Datagram Protocol - RFC 768)',
        category: 'Transport Layer (Unreliable, Connectionless)',
        headerBytes: 8,
        handshake: 'None (Instant 0-RTT transmission)',
        congestionAlg: 'None (Application level responsibility)',
        pros: [
            'Zero handshake latency delay',
            'No Head-of-Line blocking; packet loss does not halt subsequent datagrams',
            'Minimal header overhead (only 8 bytes)'
        ],
        cons: [
            'No delivery guarantee or automatic retransmission',
            'Packets may arrive out of order or duplicated',
            'Risk of overflowing network routers without congestion control'
        ],
        headerStructure: [
            { field: 'Source Port (16 bits)', desc: 'Port of sender' },
            { field: 'Destination Port (16 bits)', desc: 'Port of receiver' },
            { field: 'Length (16 bits)', desc: 'Total byte length of UDP header + payload' },
            { field: 'Checksum (16 bits)', desc: 'Optional payload integrity verification' }
        ]
    },
    {
        id: 'quic',
        name: 'QUIC Protocol / HTTP/3 (RFC 9000)',
        category: 'Transport Layer over UDP (TLS 1.3 Integrated)',
        headerBytes: 38,
        handshake: '0-RTT / 1-RTT TLS 1.3 Handshake',
        congestionAlg: 'BBR / Cubic',
        pros: [
            'Stream-level independence eliminates cross-stream Head-of-Line blocking',
            'Combined connection & TLS encryption handshake in 1 RTT (or 0 RTT for session resumption)',
            'Connection Migration supports IP switching (e.g. WiFi to Cellular) via Connection IDs'
        ],
        cons: [
            'Higher CPU usage for UDP packet processing in user-space',
            'Some corporate firewalls block UDP port 443 traffic'
        ],
        headerStructure: [
            { field: 'Header Form & Flags (8 bits)', desc: 'Long/Short header format indicator' },
            { field: 'Destination Connection ID (64 bits)', desc: 'Connection identifier across IP changes' },
            { field: 'Packet Number (32 bits)', desc: 'Monotonically increasing packet ID' },
            { field: 'Payload Frames', desc: 'STREAM, ACK, CRYPTO, PING frames' }
        ]
    }
];

export class ProtocolDeepDive {
    init() {
        this.renderKnowledgeCards();
    }

    renderKnowledgeCards() {
        const container = document.getElementById('protocolDeepDiveContainer');
        if (!container) return;

        container.innerHTML = '';
        PROTOCOL_KNOWLEDGE_BASE.forEach(item => {
            const card = document.createElement('div');
            card.className = 'glass-panel p-6 space-y-4';
            card.innerHTML = `
                <div class="flex items-center justify-between border-b border-slate-700/60 pb-3">
                    <div>
                        <h3 class="text-lg font-bold text-slate-100">${item.name}</h3>
                        <p class="text-xs text-cyan-400 font-mono">${item.category}</p>
                    </div>
                    <span class="badge badge-cyan">${item.headerBytes} B Header</span>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                        <strong class="text-emerald-400 block mb-1">Key Advantages</strong>
                        <ul class="list-disc list-inside space-y-1 text-slate-300">
                            ${item.pros.map(p => `<li>${p}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                        <strong class="text-rose-400 block mb-1">Trade-offs & Limitations</strong>
                        <ul class="list-disc list-inside space-y-1 text-slate-300">
                            ${item.cons.map(c => `<li>${c}</li>`).join('')}
                        </ul>
                    </div>
                </div>

                <div class="bg-slate-950 p-4 rounded-lg border border-slate-800">
                    <strong class="text-amber-400 text-xs font-mono block mb-2">Packet Header Specification</strong>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        ${item.headerStructure.map(h => `
                            <div class="bg-slate-900 p-2 rounded text-xs">
                                <div class="font-semibold text-slate-200">${h.field}</div>
                                <div class="text-slate-400 text-[11px]">${h.desc}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }
}
