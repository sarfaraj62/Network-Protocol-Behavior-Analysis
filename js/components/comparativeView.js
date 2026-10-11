/**
 * Side-by-Side Dual Protocol Comparative Benchmarking Module
 */
import { ProtocolSimulationInstance } from '../engine/protocolEngine.js';
import { PacketVisualizer } from './packetVisualizer.js';

export class ComparativeView {
    constructor() {
        this.simA = null;
        this.simB = null;
        this.visA = null;
        this.visB = null;
    }

    init() {
        this.visA = new PacketVisualizer('canvasCompA');
        this.visB = new PacketVisualizer('canvasCompB');

        this.resetSimulations();
    }

    resetSimulations(configA = {}, configB = {}) {
        const defaultConfigA = { appId: 'video_streaming', protocolId: 'tcp', lossRate: 5, baseRTT: 60 };
        const defaultConfigB = { appId: 'video_streaming', protocolId: 'udp', lossRate: 5, baseRTT: 60 };

        this.simA = new ProtocolSimulationInstance({ ...defaultConfigA, ...configA });
        this.simB = new ProtocolSimulationInstance({ ...defaultConfigB, ...configB });

        this.updateUI();
    }

    startBoth() {
        if (this.simA) this.simA.start();
        if (this.simB) this.simB.start();
    }

    pauseBoth() {
        if (this.simA) this.simA.pause();
        if (this.simB) this.simB.pause();
    }

    step(deltaTimeMs = 100) {
        if (this.simA && this.simA.isRunning) {
            this.simA.step(deltaTimeMs);
            if (this.visA) this.visA.render(this.simA);
        }

        if (this.simB && this.simB.isRunning) {
            this.simB.step(deltaTimeMs);
            if (this.visB) this.visB.render(this.simB);
        }

        this.updateUI();
    }

    updateUI() {
        if (!this.simA || !this.simB) return;

        const statsA = this.simA.getSummaryStats();
        const statsB = this.simB.getSummaryStats();

        // Update Scoreboard Elements
        const elTpA = document.getElementById('compTpA');
        const elTpB = document.getElementById('compTpB');
        if (elTpA) elTpA.textContent = `${statsA.avgThroughputMbps} Mbps`;
        if (elTpB) elTpB.textContent = `${statsB.avgThroughputMbps} Mbps`;

        const elGoodA = document.getElementById('compGoodA');
        const elGoodB = document.getElementById('compGoodB');
        if (elGoodA) elGoodA.textContent = `${statsA.avgGoodputMbps} Mbps (${statsA.efficiencyRatioPct}%)`;
        if (elGoodB) elGoodB.textContent = `${statsB.avgGoodputMbps} Mbps (${statsB.efficiencyRatioPct}%)`;

        const elDropA = document.getElementById('compDropA');
        const elDropB = document.getElementById('compDropB');
        if (elDropA) elDropA.textContent = `${statsA.totalPacketsDropped} (${statsA.lossRatePct}%)`;
        if (elDropB) elDropB.textContent = `${statsB.totalPacketsDropped} (${statsB.lossRatePct}%)`;

        const elStallA = document.getElementById('compStallA');
        const elStallB = document.getElementById('compStallB');
        if (elStallA) elStallA.textContent = `${statsA.stalls} stalls`;
        if (elStallB) elStallB.textContent = `${statsB.stalls} stalls`;

        // Generate Analytical Verdict
        const verdictEl = document.getElementById('compVerdictText');
        if (verdictEl) {
            const tpDiff = (parseFloat(statsB.avgThroughputMbps) - parseFloat(statsA.avgThroughputMbps)).toFixed(2);
            let verdict = ``;

            if (this.simA.protocolProfile.id === 'tcp' && this.simB.protocolProfile.id === 'udp') {
                verdict = `<strong>UDP</strong> maintains higher throughput (${statsB.avgThroughputMbps} Mbps) under <strong>${this.simA.lossRate}% loss</strong> because it avoids TCP backoff timers and Head-of-Line blocking retransmissions. However, UDP provides <strong>no data reliability</strong>, making it ideal for streaming/gaming but unsuited for bulk file transfers.`;
            } else if (this.simA.protocolProfile.id === 'tcp' && this.simB.protocolProfile.id === 'quic') {
                verdict = `<strong>QUIC / HTTP/3</strong> outperforms <strong>TCP</strong> due to 0-RTT/1-RTT TLS connection setup and independent stream multiplexing over UDP. Under packet loss, QUIC avoids cross-stream Head-of-Line stalls.`;
            } else {
                verdict = `Comparing <strong>${this.simA.protocolProfile.name}</strong> vs <strong>${this.simB.protocolProfile.name}</strong> under <strong>${this.simA.appProfile.name}</strong>. Data Goodput Efficiency: Sim A (${statsA.efficiencyRatioPct}%) vs Sim B (${statsB.efficiencyRatioPct}%).`;
            }

            verdictEl.innerHTML = verdict;
        }
    }
}
