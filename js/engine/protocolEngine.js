/**
 * Extended Network Protocol Behavior Simulation Engine
 * Features: Congestion Algorithms (Reno/Cubic/BBR), Topologies (Multi-hop, Satellite, 5G), 
 * Dynamic Impairment Spikes, Router Queue Mgmt (DropTail vs RED), and Export Suite.
 */

export const APPLICATION_PROFILES = {
    web_browsing: {
        id: 'web_browsing',
        name: 'Web Browsing (HTTP)',
        icon: 'Globe',
        description: 'Multiplexed asset fetches (HTML, CSS, JS, Images). Sensitive to handshake RTT and Head-of-Line blocking.',
        packetSize: 1200,
        burstFrequency: 8,
        totalTargetPackets: 250,
        bufferRequired: false,
        latencySensitivity: 'High',
        lossTolerance: 'Low'
    },
    video_streaming: {
        id: 'video_streaming',
        name: '4K Video Streaming (DASH/HLS)',
        icon: 'Video',
        description: 'Continuous chunked video segments. Requires high steady throughput and client playback buffer maintenance.',
        packetSize: 1460,
        burstFrequency: 25,
        totalTargetPackets: 1000,
        bufferRequired: true,
        latencySensitivity: 'Medium',
        lossTolerance: 'Medium'
    },
    gaming_voip: {
        id: 'gaming_voip',
        name: 'Real-time Gaming / VoIP',
        icon: 'Gamepad2',
        description: 'Ultra-low latency tiny updates (60-120 Hz). Prefers dropping stale frames over delayed retransmissions.',
        packetSize: 250,
        burstFrequency: 60,
        totalTargetPackets: 600,
        bufferRequired: false,
        latencySensitivity: 'Critical',
        lossTolerance: 'High'
    },
    file_transfer: {
        id: 'file_transfer',
        name: 'High-Speed File Transfer (FTP/SFTP)',
        icon: 'DownloadCloud',
        description: 'Bulk file payload. Demands maximum goodput, window scaling, and 100% data integrity without drop loss.',
        packetSize: 1460,
        burstFrequency: 45,
        totalTargetPackets: 1500,
        bufferRequired: false,
        latencySensitivity: 'Low',
        lossTolerance: 'Zero'
    },
    iot_telemetry: {
        id: 'iot_telemetry',
        name: 'IoT Sensor Telemetry',
        icon: 'Cpu',
        description: 'Periodic tiny telemetry payloads with selectable MQTT Quality of Service (QoS 0, 1, 2) levels.',
        packetSize: 128,
        burstFrequency: 5,
        totalTargetPackets: 200,
        bufferRequired: false,
        latencySensitivity: 'Low',
        lossTolerance: 'Configurable'
    }
};

export const PROTOCOL_PROFILES = {
    tcp: {
        id: 'tcp',
        name: 'TCP (Transmission Control Protocol)',
        transport: 'TCP',
        hasHandshake: true,
        handshakeRTTs: 1.5,
        reliable: true,
        congestionControl: 'Reno/Cubic',
        headOfLineBlocking: true,
        headerOverhead: 40
    },
    udp: {
        id: 'udp',
        name: 'UDP (User Datagram Protocol)',
        transport: 'UDP',
        hasHandshake: false,
        handshakeRTTs: 0,
        reliable: false,
        congestionControl: 'None',
        headOfLineBlocking: false,
        headerOverhead: 28
    },
    quic: {
        id: 'quic',
        name: 'QUIC / HTTP/3',
        transport: 'UDP',
        hasHandshake: true,
        handshakeRTTs: 0.5,
        reliable: true,
        congestionControl: 'BBR',
        headOfLineBlocking: false,
        headerOverhead: 38
    },
    websocket: {
        id: 'websocket',
        name: 'WebSocket over TCP',
        transport: 'TCP',
        hasHandshake: true,
        handshakeRTTs: 2.0,
        reliable: true,
        congestionControl: 'Reno',
        headOfLineBlocking: true,
        headerOverhead: 44
    },
    mqtt: {
        id: 'mqtt',
        name: 'MQTT over TCP',
        transport: 'TCP',
        hasHandshake: true,
        handshakeRTTs: 2.0,
        reliable: true,
        congestionControl: 'Reno',
        headOfLineBlocking: true,
        headerOverhead: 42
    }
};

export const TOPOLOGY_PROFILES = {
    standard: {
        id: 'standard',
        name: 'Single-Hop LAN / WAN',
        nodes: ['Client', 'Bottleneck Router', 'Server'],
        extraRTT: 0,
        lossMultiplier: 1.0
    },
    multi_hop: {
        id: 'multi_hop',
        name: 'Multi-Hop Enterprise Mesh',
        nodes: ['Client', 'Edge Switch', 'Core Router', 'Cloud Server'],
        extraRTT: 35,
        lossMultiplier: 1.2
    },
    satellite: {
        id: 'satellite',
        name: 'High-Latency GEO Satellite',
        nodes: ['Ground Station', 'Satellite Relay', 'Orbital Transponder', 'Remote Server'],
        extraRTT: 420,
        lossMultiplier: 1.5
    },
    cellular_5g: {
        id: 'cellular_5g',
        name: '5G Mobile Wireless',
        nodes: ['UE Mobile Device', '5G gNodeB Tower', 'UPF Core Network', 'App Server'],
        extraRTT: 15,
        lossMultiplier: 1.1
    }
};

export class ProtocolSimulationInstance {
    constructor(config = {}) {
        this.reset(config);
    }

    reset(config = {}) {
        this.appProfile = APPLICATION_PROFILES[config.appId] || APPLICATION_PROFILES.web_browsing;
        this.protocolProfile = PROTOCOL_PROFILES[config.protocolId] || PROTOCOL_PROFILES.tcp;
        this.topologyProfile = TOPOLOGY_PROFILES[config.topologyId] || TOPOLOGY_PROFILES.standard;
        this.congestionAlgorithm = config.congestionAlg || 'cubic'; // reno, cubic, bbr
        this.queuePolicy = config.queuePolicy || 'droptail'; // droptail, red
        
        // Base Network Parameters
        this.lossRate = config.lossRate !== undefined ? config.lossRate : 2;
        this.baseRTT = (config.baseRTT !== undefined ? config.baseRTT : 50) + this.topologyProfile.extraRTT;
        this.jitter = config.jitter !== undefined ? config.jitter : 5;
        this.bandwidth = config.bandwidth !== undefined ? config.bandwidth : 20;

        // Temporary Impairment Spikes
        this.activeSpikes = {
            lossUntil: 0,
            extraLoss: 0,
            latencyUntil: 0,
            extraRTT: 0,
            congestionUntil: 0
        };

        // Simulation State
        this.isRunning = false;
        this.isPaused = false;
        this.isHandshakeComplete = !this.protocolProfile.hasHandshake;
        this.handshakeProgress = 0;
        
        this.timeElapsed = 0;
        this.sequenceNumber = 1000;
        this.ackNumber = 1000;
        
        // Congestion Control State Variables
        this.cwnd = 4; // MSS
        this.ssthresh = 32;
        this.lastLossTime = 0;
        this.wMax = 32; // Cubic W_max
        this.routerQueueDepth = 0;
        this.maxRouterQueue = 25; // max packets in buffer
        
        // Metrics
        this.totalPacketsSent = 0;
        this.totalPacketsReceived = 0;
        this.totalPacketsDropped = 0;
        this.totalRetransmissions = 0;
        this.totalBytesSent = 0;
        this.totalBytesReceived = 0;
        this.totalPayloadBytesReceived = 0;
        
        this.mediaBufferLevel = 50;
        this.stallCount = 0;

        this.activePackets = []; 
        this.packetLogs = [];
        
        this.history = {
            timestamps: [],
            throughput: [],
            goodput: [],
            rtt: [],
            loss: [],
            cwnd: [],
            buffer: [],
            queue: []
        };
    }

    triggerLossSpike(extraPct = 15, durationSec = 4) {
        this.activeSpikes.extraLoss = extraPct;
        this.activeSpikes.lossUntil = this.timeElapsed + durationSec;
        this.logPacketEvent('DROP', 'SPIKE_TRIGGERED', `⚡ Network Interference Burst: Loss rate elevated by +${extraPct}% for ${durationSec}s.`);
    }

    triggerLatencySpike(extraMs = 150, durationSec = 5) {
        this.activeSpikes.extraRTT = extraMs;
        this.activeSpikes.latencyUntil = this.timeElapsed + durationSec;
        this.logPacketEvent('CONTROL', 'LATENCY_SPIKE', `🐢 Route Rerouting Spike: RTT increased by +${extraMs}ms for ${durationSec}s.`);
    }

    triggerCongestionSpike(durationSec = 5) {
        this.activeSpikes.congestionUntil = this.timeElapsed + durationSec;
        this.routerQueueDepth = this.maxRouterQueue;
        this.logPacketEvent('STALL', 'CONGESTION_SPIKE', `🚦 Bottleneck Buffer Overflow: Router queue flooded to 100% capacity.`);
    }

    start() {
        this.isRunning = true;
        this.isPaused = false;
    }

    pause() {
        this.isPaused = true;
    }

    step(deltaTimeMs = 100) {
        if (!this.isRunning || this.isPaused) return;

        const dtSec = deltaTimeMs / 1000;
        this.timeElapsed += dtSec;

        // Check active spikes
        const effectiveExtraLoss = this.timeElapsed < this.activeSpikes.lossUntil ? this.activeSpikes.extraLoss : 0;
        const effectiveExtraRTT = this.timeElapsed < this.activeSpikes.latencyUntil ? this.activeSpikes.extraRTT : 0;
        const effectiveLossRate = Math.min(100, (this.lossRate + effectiveExtraLoss) * this.topologyProfile.lossMultiplier);
        const effectiveBaseRTT = Math.max(5, this.baseRTT + effectiveExtraRTT);

        // Handle Handshake state
        if (!this.isHandshakeComplete) {
            const handshakeDurationSec = (this.protocolProfile.handshakeRTTs * effectiveBaseRTT) / 1000;
            this.handshakeProgress += dtSec / (handshakeDurationSec || 0.05);

            if (this.handshakeProgress >= 1) {
                this.isHandshakeComplete = true;
                this.handshakeProgress = 1;
                this.logPacketEvent('CONTROL', 'HANDSHAKE_ESTABLISHED', `${this.protocolProfile.name} connection established.`);
            } else {
                if (Math.random() < 0.3) {
                    const stepName = this.handshakeProgress < 0.33 ? 'SYN' : (this.handshakeProgress < 0.66 ? 'SYN-ACK' : 'ACK');
                    this.spawnPacket(stepName, 'CONTROL', 64, this.handshakeProgress < 0.5 ? 'CLIENT_TO_SERVER' : 'SERVER_TO_CLIENT');
                }
                return;
            }
        }

        const currentRTT = Math.max(5, effectiveBaseRTT + (Math.random() * 2 - 1) * this.jitter);

        // Determine Packet Generation Limit based on Congestion Window & Algorithm
        const maxPacketsPerTick = Math.min(
            Math.ceil(this.appProfile.burstFrequency * dtSec * 5),
            Math.floor(this.cwnd)
        );

        let packetsAttempted = 0;
        
        for (let i = 0; i < maxPacketsPerTick; i++) {
            if (this.totalPacketsReceived + this.activePackets.length >= this.appProfile.totalTargetPackets) {
                break;
            }

            // Router Queue Management check
            let isDropped = (Math.random() * 100) < effectiveLossRate;
            
            if (this.queuePolicy === 'droptail' && this.routerQueueDepth >= this.maxRouterQueue) {
                isDropped = true; // DropTail Buffer Overflow Drop
            } else if (this.queuePolicy === 'red' && this.routerQueueDepth > (this.maxRouterQueue * 0.6)) {
                // RED Probabilistic Early Drop
                if (Math.random() < 0.4) isDropped = true;
            }

            this.totalPacketsSent++;
            packetsAttempted++;

            const payloadSize = this.appProfile.packetSize;
            const totalSize = payloadSize + this.protocolProfile.headerOverhead;
            this.totalBytesSent += totalSize;

            const seq = this.sequenceNumber++;

            if (isDropped) {
                this.totalPacketsDropped++;
                
                if (this.protocolProfile.reliable) {
                    // Update Congestion Control State on Loss
                    this.wMax = this.cwnd;
                    this.lastLossTime = this.timeElapsed;

                    if (this.congestionAlgorithm === 'reno') {
                        // AIMD: Multiplicative Decrease 50%
                        this.ssthresh = Math.max(2, Math.floor(this.cwnd * 0.5));
                        this.cwnd = this.ssthresh;
                    } else if (this.congestionAlgorithm === 'cubic') {
                        // Cubic fast backoff
                        this.ssthresh = Math.max(2, Math.floor(this.cwnd * 0.7));
                        this.cwnd = this.ssthresh;
                    } else if (this.congestionAlgorithm === 'bbr') {
                        // Google BBR: BDP pacing, minor adjustment without collapse
                        this.cwnd = Math.max(4, this.cwnd * 0.88);
                    }

                    setTimeout(() => {
                        if (this.isRunning) {
                            this.totalRetransmissions++;
                            this.totalBytesSent += totalSize;
                            this.spawnPacket(`RETRANSMIT #${seq}`, 'RETRANSMISSION', totalSize, 'CLIENT_TO_SERVER', false, seq);
                        }
                    }, currentRTT * 1.2);
                }

                this.spawnPacket(`DATA #${seq}`, 'DATA', totalSize, 'CLIENT_TO_SERVER', true, seq);
                this.logPacketEvent('DROP', `PACKET_DROPPED #${seq}`, `Packet #${seq} dropped (${this.queuePolicy.toUpperCase()} Queue / Loss Rate ${effectiveLossRate.toFixed(1)}%).`);
            } else {
                // Successful Transmission
                this.routerQueueDepth = Math.min(this.maxRouterQueue, this.routerQueueDepth + 1);
                this.spawnPacket(`DATA #${seq}`, 'DATA', totalSize, 'CLIENT_TO_SERVER', false, seq);
                
                // Update Congestion Window on Success
                if (this.protocolProfile.reliable) {
                    if (this.congestionAlgorithm === 'reno') {
                        if (this.cwnd < this.ssthresh) this.cwnd += 0.25; // Slow start
                        else this.cwnd += 1 / this.cwnd; // AIMD
                    } else if (this.congestionAlgorithm === 'cubic') {
                        // Cubic Growth Curve: W(t) = C*(t - K)^3 + Wmax
                        const t = this.timeElapsed - this.lastLossTime;
                        const K = Math.cbrt((this.wMax * 0.3) / 0.4);
                        const cubicCwnd = 0.4 * Math.pow(t - K, 3) + this.wMax;
                        this.cwnd = Math.max(2, Math.min(64, cubicCwnd));
                    } else if (this.congestionAlgorithm === 'bbr') {
                        // BBR maintains steady max bandwidth pacing
                        this.cwnd = Math.min(48, this.cwnd + 0.3);
                    }
                }

                if (this.protocolProfile.reliable) {
                    setTimeout(() => {
                        if (this.isRunning) {
                            this.ackNumber = seq + 1;
                            this.routerQueueDepth = Math.max(0, this.routerQueueDepth - 1);
                            this.spawnPacket(`ACK #${this.ackNumber}`, 'ACK', 54, 'SERVER_TO_CLIENT', false, seq);
                            this.totalPacketsReceived++;
                            this.totalBytesReceived += totalSize;
                            this.totalPayloadBytesReceived += payloadSize;
                        }
                    }, currentRTT / 2);
                } else {
                    this.totalPacketsReceived++;
                    this.totalBytesReceived += totalSize;
                    this.totalPayloadBytesReceived += payloadSize;
                    this.routerQueueDepth = Math.max(0, this.routerQueueDepth - 1);
                }
            }
        }

        // Gradually drain queue
        if (this.routerQueueDepth > 0 && Math.random() < 0.4) {
            this.routerQueueDepth--;
        }

        // Update Video Stream Buffer Dynamics
        if (this.appProfile.bufferRequired) {
            const drainRate = 1.2 * dtSec * 15;
            const fillRate = (packetsAttempted * (100 - effectiveLossRate) / 100) * 0.8;
            this.mediaBufferLevel = Math.min(100, Math.max(0, this.mediaBufferLevel + fillRate - drainRate));
            
            if (this.mediaBufferLevel <= 0) {
                this.stallCount++;
                this.logPacketEvent('STALL', 'BUFFER_UNDERRUN', 'Video playback stalled waiting for packets.');
            }
        }

        // Real-Time Metrics
        const currentThroughputMbps = Number(((this.totalBytesReceived * 8) / (this.timeElapsed * 1000000 || 1)).toFixed(2));
        const currentGoodputMbps = Number(((this.totalPayloadBytesReceived * 8) / (this.timeElapsed * 1000000 || 1)).toFixed(2));
        const currentLossPct = this.totalPacketsSent > 0 ? Number(((this.totalPacketsDropped / this.totalPacketsSent) * 100).toFixed(1)) : 0;

        // Push History for Charts
        this.history.timestamps.push(this.timeElapsed.toFixed(1) + 's');
        this.history.throughput.push(currentThroughputMbps);
        this.history.goodput.push(currentGoodputMbps);
        this.history.rtt.push(Number(currentRTT.toFixed(1)));
        this.history.loss.push(currentLossPct);
        this.history.cwnd.push(Number(this.cwnd.toFixed(1)));
        this.history.buffer.push(Number(this.mediaBufferLevel.toFixed(1)));
        this.history.queue.push(this.routerQueueDepth);

        if (this.history.timestamps.length > 40) {
            Object.keys(this.history).forEach(key => this.history[key].shift());
        }

        this.activePackets = this.activePackets.filter(p => p.progress < 1);
    }

    spawnPacket(label, type, sizeBytes, direction = 'CLIENT_TO_SERVER', isDropped = false, seqNum = 0) {
        const packet = {
            id: 'pkt_' + Math.random().toString(36).substr(2, 9),
            label,
            type,
            sizeBytes,
            direction,
            progress: 0,
            speed: (100 / (this.baseRTT || 50)) * 0.15,
            isDropped,
            seqNum,
            protocol: this.protocolProfile.id
        };

        this.activePackets.push(packet);
    }

    logPacketEvent(severity, title, details) {
        this.packetLogs.unshift({
            id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            timestamp: new Date().toLocaleTimeString(),
            timeSec: this.timeElapsed.toFixed(2),
            severity,
            title,
            details
        });

        if (this.packetLogs.length > 100) {
            this.packetLogs.pop();
        }
    }

    getSummaryStats() {
        const totalSent = this.totalPacketsSent || 1;
        const lossPct = ((this.totalPacketsDropped / totalSent) * 100).toFixed(1);
        const avgThroughput = ((this.totalBytesReceived * 8) / (this.timeElapsed * 1000000 || 1)).toFixed(2);
        const avgGoodput = ((this.totalPayloadBytesReceived * 8) / (this.timeElapsed * 1000000 || 1)).toFixed(2);
        const efficiencyRatio = this.totalBytesReceived > 0 ? ((this.totalPayloadBytesReceived / this.totalBytesReceived) * 100).toFixed(1) : 100;

        return {
            timeElapsedSec: this.timeElapsed.toFixed(1),
            appId: this.appProfile.id,
            protocolId: this.protocolProfile.id,
            congestionAlg: this.congestionAlgorithm.toUpperCase(),
            topology: this.topologyProfile.name,
            totalPacketsSent: this.totalPacketsSent,
            totalPacketsReceived: this.totalPacketsReceived,
            totalPacketsDropped: this.totalPacketsDropped,
            totalRetransmissions: this.totalRetransmissions,
            lossRatePct: lossPct,
            avgThroughputMbps: avgThroughput,
            avgGoodputMbps: avgGoodput,
            efficiencyRatioPct: efficiencyRatio,
            cwnd: Math.round(this.cwnd),
            bufferLevelPct: Math.round(this.mediaBufferLevel),
            stalls: this.stallCount,
            queueDepth: this.routerQueueDepth
        };
    }

    exportCSVLogs() {
        const headers = ["Timestamp_Sec", "Throughput_Mbps", "Goodput_Mbps", "RTT_ms", "Loss_Rate_Pct", "Cwnd_MSS", "Buffer_Pct", "Queue_Depth"];
        const rows = this.history.timestamps.map((t, i) => [
            t,
            this.history.throughput[i],
            this.history.goodput[i],
            this.history.rtt[i],
            this.history.loss[i],
            this.history.cwnd[i],
            this.history.buffer[i],
            this.history.queue[i]
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `protocol_analysis_${this.protocolProfile.id}_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    exportJSONReport() {
        const report = {
            title: "Network Protocol Behavior Analysis Report",
            timestamp: new Date().toISOString(),
            configuration: {
                application: this.appProfile.name,
                protocol: this.protocolProfile.name,
                congestionAlgorithm: this.congestionAlgorithm,
                topology: this.topologyProfile.name,
                configuredLossRatePct: this.lossRate,
                configuredBaseRTTMs: this.baseRTT
            },
            summaryMetrics: this.getSummaryStats(),
            packetLogs: this.packetLogs
        };

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
        const link = document.createElement("a");
        link.setAttribute("href", dataStr);
        link.setAttribute("download", `network_analysis_report_${Date.now()}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
