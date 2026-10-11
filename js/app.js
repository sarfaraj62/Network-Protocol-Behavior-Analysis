/**
 * Main Web Application Controller (Extended with Advanced Feature Suite)
 */
import { ProtocolSimulationInstance, APPLICATION_PROFILES, PROTOCOL_PROFILES, TOPOLOGY_PROFILES } from './engine/protocolEngine.js';
import { PacketVisualizer } from './components/packetVisualizer.js';
import { MetricsDashboard } from './components/metricsDashboard.js';
import { ComparativeView } from './components/comparativeView.js';
import { PcapAnalyzer } from './components/pcapAnalyzer.js';
import { ProtocolDeepDive } from './components/protocolDeepDive.js';

class App {
    constructor() {
        this.simulation = new ProtocolSimulationInstance();
        this.visualizer = null;
        this.dashboard = new MetricsDashboard();
        this.comparative = new ComparativeView();
        this.pcapAnalyzer = new PcapAnalyzer();
        this.protocolDeepDive = new ProtocolDeepDive();

        this.lastFrameTime = performance.now();
        this.activeTab = 'tab-simulator';
    }

    init() {
        this.visualizer = new PacketVisualizer('canvasMainVisualizer');
        this.dashboard.initCharts();
        this.comparative.init();
        this.pcapAnalyzer.init();
        this.protocolDeepDive.init();

        this.bindEvents();
        this.startLoop();
    }

    bindEvents() {
        // Tab Navigation
        document.querySelectorAll('.nav-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');
                this.switchTab(targetTab);
            });
        });

        // Configuration Inputs
        const appSelect = document.getElementById('selectApplication');
        if (appSelect) {
            appSelect.addEventListener('change', () => this.rebuildSimulation());
        }

        const protoSelect = document.getElementById('selectProtocol');
        if (protoSelect) {
            protoSelect.addEventListener('change', () => this.rebuildSimulation());
        }

        const topoSelect = document.getElementById('selectTopology');
        if (topoSelect) {
            topoSelect.addEventListener('change', () => this.rebuildSimulation());
        }

        const algSelect = document.getElementById('selectCongestionAlg');
        if (algSelect) {
            algSelect.addEventListener('change', () => this.rebuildSimulation());
        }

        const queueSelect = document.getElementById('selectQueuePolicy');
        if (queueSelect) {
            queueSelect.addEventListener('change', () => this.rebuildSimulation());
        }

        // Network Sliders
        const rangeLoss = document.getElementById('rangeLoss');
        if (rangeLoss) {
            rangeLoss.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                document.getElementById('valLoss').textContent = `${val}%`;
                this.simulation.lossRate = val;
            });
        }

        const rangeRTT = document.getElementById('rangeRTT');
        if (rangeRTT) {
            rangeRTT.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10);
                document.getElementById('valRTT').textContent = `${val} ms`;
                this.simulation.baseRTT = val;
            });
        }

        const rangeJitter = document.getElementById('rangeJitter');
        if (rangeJitter) {
            rangeJitter.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10);
                document.getElementById('valJitter').textContent = `${val} ms`;
                this.simulation.jitter = val;
            });
        }

        // Impairment Spike Trigger Buttons
        const btnSpikeLoss = document.getElementById('btnSpikeLoss');
        if (btnSpikeLoss) {
            btnSpikeLoss.addEventListener('click', () => this.simulation.triggerLossSpike(15, 4));
        }

        const btnSpikeRTT = document.getElementById('btnSpikeRTT');
        if (btnSpikeRTT) {
            btnSpikeRTT.addEventListener('click', () => this.simulation.triggerLatencySpike(150, 5));
        }

        const btnSpikeCongest = document.getElementById('btnSpikeCongest');
        if (btnSpikeCongest) {
            btnSpikeCongest.addEventListener('click', () => this.simulation.triggerCongestionSpike(5));
        }

        // Data Export Buttons
        const btnExportCSV = document.getElementById('btnExportCSV');
        if (btnExportCSV) {
            btnExportCSV.addEventListener('click', () => this.simulation.exportCSVLogs());
        }

        const btnExportJSON = document.getElementById('btnExportJSON');
        if (btnExportJSON) {
            btnExportJSON.addEventListener('click', () => this.simulation.exportJSONReport());
        }

        // Play / Pause / Reset Buttons
        const btnStart = document.getElementById('btnStartSim');
        if (btnStart) {
            btnStart.addEventListener('click', () => {
                if (this.simulation.isRunning && !this.simulation.isPaused) {
                    this.simulation.pause();
                    btnStart.innerHTML = '▶ Resume Simulation';
                } else {
                    this.simulation.start();
                    btnStart.innerHTML = '⏸ Pause Simulation';
                }
            });
        }

        const btnReset = document.getElementById('btnResetSim');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                this.rebuildSimulation();
                const btnStart = document.getElementById('btnStartSim');
                if (btnStart) btnStart.innerHTML = '▶ Start Simulation';
            });
        }

        // Comparative Controls
        const btnStartComp = document.getElementById('btnStartComp');
        if (btnStartComp) {
            btnStartComp.addEventListener('click', () => this.comparative.startBoth());
        }

        const btnResetComp = document.getElementById('btnResetComp');
        if (btnResetComp) {
            btnResetComp.addEventListener('click', () => {
                const protoA = document.getElementById('selectCompProtoA').value;
                const protoB = document.getElementById('selectCompProtoB').value;
                const app = document.getElementById('selectCompApp').value;
                const loss = parseFloat(document.getElementById('rangeCompLoss').value);

                this.comparative.resetSimulations(
                    { appId: app, protocolId: protoA, lossRate: loss },
                    { appId: app, protocolId: protoB, lossRate: loss }
                );
            });
        }

        this.updateControlInfo();
    }

    rebuildSimulation() {
        const appId = document.getElementById('selectApplication')?.value || 'web_browsing';
        const protocolId = document.getElementById('selectProtocol')?.value || 'tcp';
        const topologyId = document.getElementById('selectTopology')?.value || 'standard';
        const congestionAlg = document.getElementById('selectCongestionAlg')?.value || 'cubic';
        const queuePolicy = document.getElementById('selectQueuePolicy')?.value || 'droptail';
        const lossRate = parseFloat(document.getElementById('rangeLoss')?.value || 2);
        const baseRTT = parseInt(document.getElementById('rangeRTT')?.value || 50, 10);
        const jitter = parseInt(document.getElementById('rangeJitter')?.value || 5, 10);

        this.simulation.reset({
            appId,
            protocolId,
            topologyId,
            congestionAlg,
            queuePolicy,
            lossRate,
            baseRTT,
            jitter
        });

        this.updateControlInfo();
        this.updateMetricsDisplay();
    }

    switchTab(tabId) {
        this.activeTab = tabId;
        document.querySelectorAll('.nav-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

        const activeBtn = document.querySelector(`[data-tab="${tabId}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        const activeContent = document.getElementById(tabId);
        if (activeContent) activeContent.classList.remove('hidden');
    }

    updateControlInfo() {
        const app = APPLICATION_PROFILES[this.simulation.appProfile.id];
        const proto = PROTOCOL_PROFILES[this.simulation.protocolProfile.id];

        const appDesc = document.getElementById('textAppDesc');
        if (appDesc) appDesc.textContent = app ? app.description : '';

        const protoDesc = document.getElementById('textProtoDesc');
        if (protoDesc) protoDesc.textContent = proto ? `${proto.transport} Transport | ${proto.reliable ? 'Reliable' : 'Unreliable'} | Congestion: ${this.simulation.congestionAlgorithm.toUpperCase()}` : '';
    }

    startLoop() {
        const tick = (now) => {
            const dtMs = Math.min(200, now - this.lastFrameTime);
            this.lastFrameTime = now;

            if (this.activeTab === 'tab-simulator') {
                if (this.simulation.isRunning) {
                    this.simulation.step(dtMs);
                    this.dashboard.update(this.simulation);
                    this.updateMetricsDisplay();
                    this.renderPacketLogs();
                }

                if (this.visualizer) {
                    this.visualizer.render(this.simulation);
                }
            } else if (this.activeTab === 'tab-comparative') {
                this.comparative.step(dtMs);
            }

            requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
    }

    updateMetricsDisplay() {
        const stats = this.simulation.getSummaryStats();

        const elTp = document.getElementById('metricThroughput');
        if (elTp) elTp.textContent = `${stats.avgThroughputMbps} Mbps`;

        const elGood = document.getElementById('metricGoodput');
        if (elGood) elGood.textContent = `${stats.avgGoodputMbps} Mbps (${stats.efficiencyRatioPct}%)`;

        const elDrop = document.getElementById('metricLoss');
        if (elDrop) elDrop.textContent = `${stats.totalPacketsDropped} (${stats.lossRatePct}%)`;

        const elRetx = document.getElementById('metricRetx');
        if (elRetx) elRetx.textContent = `${stats.totalRetransmissions}`;

        const elCwnd = document.getElementById('metricCwnd');
        if (elCwnd) elCwnd.textContent = `${stats.cwnd} MSS`;
    }

    renderPacketLogs() {
        const container = document.getElementById('logStreamBody');
        if (!container) return;

        const logs = this.simulation.packetLogs.slice(0, 15);
        container.innerHTML = logs.map(l => `
            <div class="log-row">
                <span class="text-slate-500">${l.timeSec}s</span>
                <span class="badge ${l.severity === 'DROP' ? 'badge-rose' : (l.severity === 'STALL' ? 'badge-amber' : 'badge-cyan')}">${l.severity}</span>
                <span class="font-semibold text-slate-200">${l.title}</span>
                <span class="text-slate-400 truncate">${l.details}</span>
            </div>
        `).join('');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    window.app.init();
});
