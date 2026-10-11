/**
 * HTML5 Canvas Packet Flow Visualizer with Multi-Topology Node Rendering
 */

export class PacketVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.animationFrameId = null;
        this.particles = [];
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this.canvas) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height || 320;
    }

    render(simulationInstance) {
        if (!this.ctx || !this.canvas) return;

        const width = this.canvas.width;
        const height = this.canvas.height;
        const ctx = this.ctx;

        ctx.clearRect(0, 0, width, height);

        const topologyId = simulationInstance ? simulationInstance.topologyProfile.id : 'standard';
        const nodes = this.getTopologyNodes(width, height, topologyId);

        // Draw Cables / Wireless Channels
        for (let i = 0; i < nodes.length - 1; i++) {
            this.drawCable(ctx, nodes[i], nodes[i + 1], simulationInstance);
        }

        // Draw Nodes
        nodes.forEach((node, idx) => {
            const isRouterOrGateway = idx > 0 && idx < nodes.length - 1;
            const lossPct = isRouterOrGateway && simulationInstance ? simulationInstance.lossRate : 0;
            const queueDepth = isRouterOrGateway && simulationInstance ? simulationInstance.routerQueueDepth : 0;
            this.drawNode(ctx, node, node.color, true, lossPct, queueDepth);
        });

        if (!simulationInstance) return;

        // Render Active Packets
        const packets = simulationInstance.activePackets;
        const firstNode = nodes[0];
        const lastNode = nodes[nodes.length - 1];
        
        for (let i = packets.length - 1; i >= 0; i--) {
            const pkt = packets[i];
            pkt.progress += pkt.speed;

            if (pkt.isDropped && pkt.progress >= 0.5) {
                const bottleneck = nodes[Math.floor(nodes.length / 2)];
                this.spawnExplosion(bottleneck.x, bottleneck.y);
                packets.splice(i, 1);
                continue;
            }

            if (pkt.progress >= 1) {
                packets.splice(i, 1);
                continue;
            }

            let start = firstNode;
            let end = lastNode;

            if (pkt.direction === 'SERVER_TO_CLIENT') {
                start = lastNode;
                end = firstNode;
            }

            const currentX = start.x + (end.x - start.x) * pkt.progress;
            const currentY = start.y + (end.y - start.y) * pkt.progress;

            this.drawPacketParticle(ctx, currentX, currentY, pkt);
        }

        this.renderExplosions(ctx);
    }

    getTopologyNodes(width, height, topologyId) {
        if (topologyId === 'multi_hop') {
            return [
                { x: width * 0.12, y: height * 0.5, label: 'Client Node', icon: '💻', color: '#06b6d4' },
                { x: width * 0.38, y: height * 0.5, label: 'Edge Switch', icon: '🔀', color: '#3b82f6' },
                { x: width * 0.62, y: height * 0.5, label: 'Core Router', icon: '🌐', color: '#8b5cf6' },
                { x: width * 0.88, y: height * 0.5, label: 'Cloud Server', icon: '🖧', color: '#10b981' }
            ];
        }

        if (topologyId === 'satellite') {
            return [
                { x: width * 0.15, y: height * 0.7, label: 'Ground Station', icon: '📡', color: '#06b6d4' },
                { x: width * 0.50, y: height * 0.25, label: 'Orbital Satellite', icon: '🛰️', color: '#f59e0b' },
                { x: width * 0.85, y: height * 0.7, label: 'Remote Server', icon: '🖧', color: '#10b981' }
            ];
        }

        if (topologyId === 'cellular_5g') {
            return [
                { x: width * 0.15, y: height * 0.5, label: '5G Mobile UE', icon: '📱', color: '#06b6d4' },
                { x: width * 0.50, y: height * 0.5, label: '5G gNodeB Tower', icon: '🗼', color: '#8b5cf6' },
                { x: width * 0.85, y: height * 0.5, label: 'App Server', icon: '🖧', color: '#10b981' }
            ];
        }

        // Standard Single-Hop
        return [
            { x: width * 0.15, y: height * 0.5, label: 'Client Node', icon: '💻', color: '#06b6d4' },
            { x: width * 0.50, y: height * 0.5, label: 'Bottleneck Router', icon: '🌐', color: '#8b5cf6' },
            { x: width * 0.85, y: height * 0.5, label: 'Server Node', icon: '🖧', color: '#10b981' }
        ];
    }

    drawCable(ctx, nodeA, nodeB, sim) {
        ctx.beginPath();
        ctx.moveTo(nodeA.x, nodeA.y);
        ctx.lineTo(nodeB.x, nodeB.y);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 8]);
        ctx.stroke();
        ctx.setLineDash([]);

        if (sim && sim.isRunning) {
            const time = Date.now() * 0.003;
            ctx.beginPath();
            ctx.moveTo(nodeA.x, nodeA.y);
            ctx.lineTo(nodeB.x, nodeB.y);
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 12]);
            ctx.lineDashOffset = -time * 20;
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    drawNode(ctx, node, colorHex, isActive = true, lossRatePct = 0, queueDepth = 0) {
        if (isActive) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, 36, 0, Math.PI * 2);
            ctx.fillStyle = colorHex + '18';
            ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, 26, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = colorHex;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = colorHex;
        ctx.shadowBlur = isActive ? 12 : 0;
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.icon, node.x, node.y);

        ctx.font = '500 12px Inter, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(node.label, node.x, node.y + 44);

        if (queueDepth > 0) {
            ctx.font = '400 10px JetBrains Mono, monospace';
            ctx.fillStyle = queueDepth > 18 ? '#f43f5e' : '#f59e0b';
            ctx.fillText(`Buffer Queue: ${queueDepth}/25`, node.x, node.y + 60);
        }
    }

    drawPacketParticle(ctx, x, y, pkt) {
        let color = '#06b6d4';
        if (pkt.type === 'ACK') color = '#10b981';
        if (pkt.type === 'CONTROL') color = '#8b5cf6';
        if (pkt.type === 'RETRANSMISSION') color = '#f59e0b';
        if (pkt.isDropped) color = '#f43f5e';

        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.font = '500 10px JetBrains Mono, monospace';
        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'center';
        ctx.fillText(pkt.label, x, y - 12);
    }

    spawnExplosion(x, y) {
        for (let i = 0; i < 12; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 3;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                alpha: 1,
                radius: 2 + Math.random() * 3
            });
        }
    }

    renderExplosions(ctx) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= 0.04;

            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(244, 63, 94, ${p.alpha})`;
            ctx.fill();
        }
    }
}
