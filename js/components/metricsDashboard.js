/**
 * Real-time Chart.js Dashboard Manager
 * Manages live interactive time-series plots for Throughput, Goodput, Latency, Loss, cwnd, and Buffer.
 */

export class MetricsDashboard {
    constructor() {
        this.charts = {};
    }

    initCharts() {
        if (typeof Chart === 'undefined') return;

        // Global Chart Defaults for sleek dark mode
        Chart.defaults.color = '#94a3b8';
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.9)';
        Chart.defaults.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.1)';
        Chart.defaults.plugins.tooltip.borderWidth = 1;

        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { maxTicksLimit: 8 }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                }
            },
            plugins: {
                legend: { labels: { usePointStyle: true, boxWidth: 8 } }
            }
        };

        // 1. Throughput vs Goodput Chart
        const tpCanvas = document.getElementById('chartThroughput');
        if (tpCanvas) {
            this.charts.throughput = new Chart(tpCanvas, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'Raw Throughput (Mbps)',
                            borderColor: '#06b6d4',
                            backgroundColor: 'rgba(6, 182, 212, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.3,
                            data: []
                        },
                        {
                            label: 'Payload Goodput (Mbps)',
                            borderColor: '#10b981',
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                            borderDash: [4, 4],
                            tension: 0.3,
                            data: []
                        }
                    ]
                },
                options: commonOptions
            });
        }

        // 2. Latency & Congestion Window Chart
        const latCanvas = document.getElementById('chartLatency');
        if (latCanvas) {
            this.charts.latency = new Chart(latCanvas, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'RTT Latency (ms)',
                            borderColor: '#8b5cf6',
                            borderWidth: 2,
                            tension: 0.3,
                            data: []
                        },
                        {
                            label: 'Congestion Window (cwnd)',
                            borderColor: '#f59e0b',
                            borderWidth: 2,
                            tension: 0.3,
                            yAxisID: 'yCwnd',
                            data: []
                        }
                    ]
                },
                options: {
                    ...commonOptions,
                    scales: {
                        ...commonOptions.scales,
                        yCwnd: {
                            position: 'right',
                            grid: { drawOnChartArea: false },
                            ticks: { precision: 0 }
                        }
                    }
                }
            });
        }

        // 3. Loss & Buffer Level Chart
        const lossCanvas = document.getElementById('chartLossBuffer');
        if (lossCanvas) {
            this.charts.lossBuffer = new Chart(lossCanvas, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'Packet Loss Rate (%)',
                            borderColor: '#f43f5e',
                            backgroundColor: 'rgba(244, 63, 94, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            data: []
                        },
                        {
                            label: 'Playback Buffer Level (%)',
                            borderColor: '#3b82f6',
                            borderWidth: 2,
                            data: []
                        }
                    ]
                },
                options: commonOptions
            });
        }
    }

    update(simulationInstance) {
        if (!simulationInstance || !this.charts.throughput) return;

        const h = simulationInstance.history;
        if (!h.timestamps.length) return;

        // Update Throughput Chart
        this.charts.throughput.data.labels = h.timestamps;
        this.charts.throughput.data.datasets[0].data = h.throughput;
        this.charts.throughput.data.datasets[1].data = h.goodput;
        this.charts.throughput.update('none');

        // Update Latency / Cwnd Chart
        this.charts.latency.data.labels = h.timestamps;
        this.charts.latency.data.datasets[0].data = h.rtt;
        this.charts.latency.data.datasets[1].data = h.cwnd;
        this.charts.latency.update('none');

        // Update Loss / Buffer Chart
        this.charts.lossBuffer.data.labels = h.timestamps;
        this.charts.lossBuffer.data.datasets[0].data = h.loss;
        this.charts.lossBuffer.data.datasets[1].data = h.buffer;
        this.charts.lossBuffer.update('none');
    }
}
