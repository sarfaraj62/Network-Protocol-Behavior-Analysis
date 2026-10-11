/**
 * PHP Backend API Client
 * Connects the frontend simulation engine to the PHP REST backend.
 * Auto-detects base URL from the current page location.
 */

const API_BASE = (() => {
    // When served via PHP (localhost), use relative paths
    const loc = window.location;
    if (loc.protocol === 'file:') {
        // File-based: PHP not available — API calls will silently no-op
        return null;
    }
    return `${loc.protocol}//${loc.host}/api`;
})();

const PHP_AVAILABLE = API_BASE !== null;

// ─── Core fetch helper ──────────────────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
    if (!PHP_AVAILABLE) return null;

    try {
        const res = await fetch(`${API_BASE}/${endpoint}`, {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options,
        });
        const json = await res.json();
        if (json.status !== 'ok') throw new Error(json.message || 'API error');
        return json.data;
    } catch (err) {
        console.warn(`[API] ${endpoint} failed:`, err.message);
        return null;
    }
}

// ─── Session API ────────────────────────────────────────────────────────────
export const SessionAPI = {

    /**
     * Save or update a simulation session to the PHP backend.
     * @param {Object} simState - Current simulation state
     * @param {Array}  packetLogs - Recent packet log entries
     * @returns {Promise<string|null>} session_uid or null
     */
    async save(simState, packetLogs = []) {
        const body = {
            session_uid:  simState.sessionUid,
            protocol:     simState.protocolProfile?.id ?? 'unknown',
            application:  simState.appProfile?.id ?? 'unknown',
            topology:     simState.topologyProfile?.id ?? 'standard',
            congestion:   simState.congestionAlgorithm ?? 'cubic',
            queue_policy: simState.queuePolicy ?? 'droptail',
            loss_rate:    simState.lossRate ?? 0,
            base_rtt:     simState.baseRTT ?? 50,
            jitter:       simState.jitter ?? 5,
            metrics:      simState.getSummaryStats?.() ?? {},
            packet_logs:  packetLogs.map(l => ({
                timeSec:  l.timeSec,
                severity: l.severity,
                title:    l.title,
                details:  l.details,
                seqNo:    l.seqNo ?? 0,
            })),
        };

        const data = await apiFetch('sessions.php', {
            method: 'POST',
            body: JSON.stringify(body),
        });

        return data?.session_uid ?? null;
    },

    /** Fetch all sessions (paginated) */
    async list(page = 1, limit = 20) {
        return await apiFetch(`sessions.php?page=${page}&limit=${limit}`);
    },

    /** Fetch a single session with its packet logs */
    async get(uid) {
        return await apiFetch(`sessions.php?id=${encodeURIComponent(uid)}`);
    },

    /** Delete a session */
    async delete(uid) {
        return await apiFetch(`sessions.php?id=${encodeURIComponent(uid)}`, {
            method: 'DELETE',
        });
    },
};

// ─── Reports API ────────────────────────────────────────────────────────────
export const ReportsAPI = {

    /**
     * Save a CSV or JSON report to the PHP server.
     * @param {'csv'|'json'} type
     * @param {string} content - The CSV/JSON string content
     * @param {string} sessionUid - Associated session UID
     */
    async save(type, content, sessionUid = 'unknown') {
        const data = await apiFetch('reports.php', {
            method: 'POST',
            body: JSON.stringify({ type, content, session_uid: sessionUid }),
        });
        return data;
    },

    /** List all saved reports */
    async list() {
        return await apiFetch('reports.php');
    },

    /** Download a saved report — opens browser download */
    download(filename) {
        if (!PHP_AVAILABLE) return;
        window.open(`${API_BASE}/reports.php?download=${encodeURIComponent(filename)}`, '_blank');
    },
};

// ─── PCAP Upload API ────────────────────────────────────────────────────────
export const PcapAPI = {

    /**
     * Upload a PCAP / CSV trace file to the PHP backend for parsing.
     * @param {File} file - Browser File object
     * @returns {Promise<Object|null>} Parsed packet data
     */
    async upload(file) {
        if (!PHP_AVAILABLE) {
            console.warn('[API] PHP not available — PCAP upload unavailable');
            return null;
        }

        const formData = new FormData();
        formData.append('pcap', file);

        try {
            const res = await fetch(`${API_BASE}/pcap_upload.php`, {
                method: 'POST',
                body: formData,
            });
            const json = await res.json();
            if (json.status !== 'ok') throw new Error(json.message);
            return json.data;
        } catch (err) {
            console.warn('[API] PCAP upload failed:', err.message);
            return null;
        }
    },

    /** List previously uploaded PCAP files */
    async list() {
        return await apiFetch('pcap_upload.php');
    },

    /** Get parsed data for a specific PCAP record */
    async get(id) {
        return await apiFetch(`pcap_upload.php?id=${id}`);
    },
};

// ─── Stats API ──────────────────────────────────────────────────────────────
export const StatsAPI = {
    async get() {
        return await apiFetch('stats.php');
    },
};

// ─── Availability Check ─────────────────────────────────────────────────────
export function isBackendAvailable() {
    return PHP_AVAILABLE;
}

export async function pingBackend() {
    if (!PHP_AVAILABLE) return false;
    try {
        const res = await fetch(`${API_BASE}/stats.php`, { method: 'GET' });
        return res.ok;
    } catch {
        return false;
    }
}
