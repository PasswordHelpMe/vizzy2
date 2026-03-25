// Vizio TV Controller Web App — Tactical Noir UI
class VizioTVController {
    constructor() {
        this.apiUrl = localStorage.getItem('vizioApiUrl') || '';
        this.isConnected = false;
        this.tvInfo = null;
        this.init();
    }

    init() {
        this.setupTabNavigation();
        this.setupVolumeSlider();
        this.setupSettingsButton();
        this.setupAppSearch();
        this.loadSettings();
        this.setupServiceWorker();
        this.testConnection();
    }

    // Tab Navigation
    setupTabNavigation() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabPanels = document.querySelectorAll('.tab-panel');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');

                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                tabPanels.forEach(panel => panel.classList.remove('active'));
                document.getElementById(targetTab).classList.add('active');

                if (targetTab === 'input' && this.tvInfo) {
                    this.updateActiveInput(this.tvInfo.input);
                }
            });
        });
    }

    // Settings button toggles settings tab
    setupSettingsButton() {
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            this._previousTab = 'power';
            settingsBtn.addEventListener('click', () => {
                const settingsPanel = document.getElementById('settings');
                const isSettingsOpen = settingsPanel.classList.contains('active');

                if (isSettingsOpen) {
                    // Go back to previous tab
                    const tabButtons = document.querySelectorAll('.tab-btn');
                    const tabPanels = document.querySelectorAll('.tab-panel');
                    tabPanels.forEach(panel => panel.classList.remove('active'));
                    document.getElementById(this._previousTab).classList.add('active');
                    tabButtons.forEach(btn => {
                        btn.classList.toggle('active', btn.getAttribute('data-tab') === this._previousTab);
                    });
                } else {
                    // Save current tab and open settings
                    const activeBtn = document.querySelector('.tab-btn.active');
                    if (activeBtn) this._previousTab = activeBtn.getAttribute('data-tab');
                    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
                    settingsPanel.classList.add('active');
                }
            });
        }
    }

    // App search filter
    setupAppSearch() {
        const searchInput = document.getElementById('appSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                const cards = document.querySelectorAll('#appsGrid .app-card');
                cards.forEach(card => {
                    const label = card.querySelector('.app-card-label');
                    if (label) {
                        const match = label.textContent.toLowerCase().includes(query);
                        card.style.display = match ? '' : 'none';
                    }
                });
            });
        }
    }

    // Volume Slider (touch-based on track element)
    setupVolumeSlider() {
        const track = document.getElementById('volumeTrack');
        if (!track) return;

        let dragging = false;

        const getVolumeFromY = (clientY) => {
            const rect = track.getBoundingClientRect();
            const y = clientY - rect.top;
            const pct = 1 - (y / rect.height);
            return Math.round(Math.max(0, Math.min(100, pct * 100)));
        };

        track.addEventListener('pointerdown', (e) => {
            dragging = true;
            track.setPointerCapture(e.pointerId);
            const vol = getVolumeFromY(e.clientY);
            this.updateVolumeUI(vol);
        });

        track.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            const vol = getVolumeFromY(e.clientY);
            this.updateVolumeUI(vol);
        });

        track.addEventListener('pointerup', (e) => {
            if (!dragging) return;
            dragging = false;
            const vol = getVolumeFromY(e.clientY);
            this.updateVolumeUI(vol);
            this.setVolume(vol);
        });

        track.addEventListener('pointercancel', () => {
            dragging = false;
        });
    }

    // Update all volume UI elements
    updateVolumeUI(value) {
        // Volume tab
        const bigNumber = document.getElementById('volumeBigNumber');
        const trackFill = document.getElementById('volumeTrackFill');
        const trackThumb = document.getElementById('volumeTrackThumb');

        if (bigNumber) bigNumber.textContent = value;
        if (trackFill) trackFill.style.height = `${value}%`;
        if (trackThumb) trackThumb.style.bottom = `${value}%`;

        // Power tab bento
        const bentoVol = document.getElementById('volumeStatus');
        if (bentoVol) bentoVol.textContent = value;

        // Remote tab
        const remoteVol = document.getElementById('remoteVolDisplay');
        const remoteBar = document.getElementById('remoteVolBar');
        if (remoteVol) remoteVol.textContent = value;
        if (remoteBar) remoteBar.style.width = `${value}%`;
    }

    // API Communication
    async makeApiRequest(endpoint, method = 'GET', data = null) {
        try {
            const url = `${this.apiUrl}${endpoint}`;
            const options = {
                method,
                headers: { 'Content-Type': 'application/json' }
            };

            if (data) {
                options.body = JSON.stringify(data);
            }

            const response = await fetch(url, options);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            this.showToast('Connection failed', 'error');
            return null;
        }
    }

    // Test Connection
    async testConnection() {
        this.showLoading(true);
        this.updateConnectionStatus('Connecting...', false);

        try {
            const response = await this.makeApiRequest('/health');
            if (response) {
                this.isConnected = true;
                this.updateConnectionStatus('Connected', true);
                this.showToast('Connected to TV', 'success');
                this.refreshStatus();
                this.loadApps();
            } else {
                this.isConnected = false;
                this.updateConnectionStatus('Disconnected', false);
                this.showToast('Failed to connect', 'error');
            }
        } catch (error) {
            this.isConnected = false;
            this.updateConnectionStatus('Disconnected', false);
            this.showToast('Connection failed', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Update Connection Status
    updateConnectionStatus(text, connected) {
        const statusText = document.getElementById('statusText');
        const statusDot = document.getElementById('statusDot');
        const heroBadge = document.getElementById('heroBadgeText');
        const heroBarFill = document.getElementById('heroBarFill');
        const connectionInfo = document.getElementById('connectionInfo');
        const apiStatus = document.getElementById('apiStatus');

        if (statusText) statusText.textContent = text;
        if (statusDot) statusDot.classList.toggle('connected', connected);
        if (heroBadge) heroBadge.textContent = connected ? 'Connected' : 'Disconnected';
        if (heroBarFill) heroBarFill.style.width = connected ? '100%' : '0%';
        if (connectionInfo) connectionInfo.textContent = connected ? 'Active' : 'Inactive';
        if (apiStatus) apiStatus.textContent = connected ? 'Online' : 'Offline';
    }

    // Refresh TV Status
    async refreshStatus() {
        if (!this.isConnected) return;

        try {
            const tvInfo = await this.makeApiRequest('/tv/info');
            if (tvInfo) {
                this.tvInfo = tvInfo;
                this.updateStatusDisplay(tvInfo);
            }
        } catch (error) {
            console.error('Failed to refresh status:', error);
        }
    }

    // Update Status Display
    updateStatusDisplay(tvInfo) {
        // Power status
        const powerStatus = document.getElementById('powerStatus');
        const powerBtn = document.getElementById('powerToggleBtn');
        const powerText = document.getElementById('powerToggleText');
        const isOn = tvInfo.power === 'on' || tvInfo.power === 'On' || tvInfo.power === true;

        if (powerStatus) powerStatus.textContent = isOn ? 'ON' : 'OFF';
        if (powerBtn) {
            powerBtn.classList.toggle('power-on-state', !isOn);
        }
        if (powerText) {
            powerText.textContent = isOn ? 'POWER OFF SYSTEM' : 'POWER ON SYSTEM';
        }

        // Volume
        const vol = tvInfo.volume || 0;
        this.updateVolumeUI(vol);

        // Input
        const inputStatus = document.getElementById('inputStatus');
        const currentInput = document.getElementById('currentInputDisplay');
        if (inputStatus) inputStatus.textContent = tvInfo.input || 'Unknown';
        if (currentInput) currentInput.textContent = tvInfo.input || 'Unknown';
        this.updateActiveInput(tvInfo.input);

        // Mute
        const muteStatus = document.getElementById('muteStatus');
        if (muteStatus) muteStatus.textContent = tvInfo.muted ? 'YES' : 'NO';
    }

    // Power Control
    async setPower(power) {
        if (!this.isConnected) {
            this.showToast('Not connected to TV', 'error');
            return;
        }

        this.showLoading(true);
        try {
            const response = await this.makeApiRequest('/tv/power', 'POST', { power });
            if (response) {
                this.showToast(`TV turned ${power}`, 'success');
                this.refreshStatus();
            }
        } catch (error) {
            this.showToast('Failed to control power', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Toggle Power based on current state
    togglePower() {
        const isOn = this.tvInfo && (this.tvInfo.power === 'on' || this.tvInfo.power === 'On' || this.tvInfo.power === true);
        this.setPower(isOn ? 'off' : 'on');
    }

    // Volume Control
    async setVolume(volume) {
        if (!this.isConnected) {
            this.showToast('Not connected to TV', 'error');
            return;
        }

        try {
            const response = await this.makeApiRequest('/tv/volume', 'POST', { volume });
            if (response) {
                this.showToast(`Volume set to ${volume}%`, 'success');
                this.refreshStatus();
            }
        } catch (error) {
            this.showToast('Failed to set volume', 'error');
        }
    }

    // Mute Control
    async setMute(muted) {
        if (!this.isConnected) {
            this.showToast('Not connected to TV', 'error');
            return;
        }

        try {
            const response = await this.makeApiRequest(`/tv/mute?muted=${muted}`, 'POST');
            if (response) {
                this.showToast(muted ? 'TV muted' : 'TV unmuted', 'success');
                this.refreshStatus();
            }
        } catch (error) {
            this.showToast('Failed to control mute', 'error');
        }
    }

    // Update active input card highlighting
    updateActiveInput(currentInput) {
        if (!currentInput) return;
        const inputGrid = document.getElementById('inputGrid');
        if (!inputGrid) return;

        // Clear all active states
        inputGrid.querySelectorAll('.input-card').forEach(card => {
            card.classList.remove('input-card-active');
            const icon = card.querySelector('.input-card-icon');
            if (icon) icon.classList.remove('filled');
            const dot = card.querySelector('.input-active-dot-wrapper');
            if (dot) dot.remove();
            const name = card.querySelector('.input-card-name');
            if (name) name.classList.remove('active');
            const status = card.querySelector('.input-card-status');
            if (status) {
                status.classList.remove('active');
                status.textContent = 'Ready';
            }
        });

        // Set active state on matching card (normalize spaces/hyphens for matching)
        const normalized = currentInput.replace(/\s+/g, '-');
        const activeCard = inputGrid.querySelector(`[data-input="${normalized}"]`) ||
                           inputGrid.querySelector(`[data-input="${currentInput}"]`);
        if (activeCard) {
            activeCard.classList.add('input-card-active');
            const icon = activeCard.querySelector('.input-card-icon');
            if (icon) icon.classList.add('filled');
            // Add active dot
            const top = activeCard.querySelector('.input-card-top');
            if (top && !top.querySelector('.input-active-dot-wrapper')) {
                const dotWrapper = document.createElement('div');
                dotWrapper.className = 'input-active-dot-wrapper';
                dotWrapper.innerHTML = '<span class="input-active-dot-ping"></span><span class="input-active-dot"></span>';
                top.appendChild(dotWrapper);
            }
            const name = activeCard.querySelector('.input-card-name');
            if (name) name.classList.add('active');
            const status = activeCard.querySelector('.input-card-status');
            if (status) {
                status.classList.add('active');
                status.textContent = 'Current Active';
            }
        }
    }

    // Input Control
    async setInput(inputName) {
        if (!this.isConnected) {
            this.showToast('Not connected to TV', 'error');
            return;
        }

        this.showLoading(true);
        try {
            const response = await this.makeApiRequest('/tv/input', 'POST', { input_name: inputName });
            if (response) {
                this.showToast(`Switched to ${inputName}`, 'success');
                this.refreshStatus();
            }
        } catch (error) {
            this.showToast('Failed to switch input', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Load Apps from TV
    async loadApps() {
        const grid = document.getElementById('appsGrid');
        const response = await this.makeApiRequest('/tv/apps');
        if (response && response.apps) {
            grid.innerHTML = '';
            response.apps.forEach(appName => {
                const button = document.createElement('button');
                button.className = 'app-card';
                button.onclick = () => this.launchApp(appName);

                const iconWrapper = document.createElement('div');
                iconWrapper.className = 'app-card-icon';
                const icon = document.createElement('span');
                icon.className = 'material-symbols-outlined';
                icon.textContent = 'tv';
                iconWrapper.appendChild(icon);

                const label = document.createElement('span');
                label.className = 'app-card-label';
                label.textContent = appName;

                button.appendChild(iconWrapper);
                button.appendChild(label);
                grid.appendChild(button);
            });
        }
    }

    // App Launch
    async launchApp(appName) {
        if (!this.isConnected) {
            this.showToast('Not connected to TV', 'error');
            return;
        }

        this.showLoading(true);
        try {
            const response = await this.makeApiRequest('/tv/app', 'POST', { app_name: appName });
            if (response) {
                this.showToast(`Launching ${appName}`, 'success');
            }
        } catch (error) {
            this.showToast(`Failed to launch ${appName}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Remote Key
    async sendRemoteKey(key) {
        if (!this.isConnected) {
            this.showToast('Not connected to TV', 'error');
            return;
        }

        try {
            const response = await this.makeApiRequest('/tv/remote', 'POST', { key });
            if (response) {
                // Subtle feedback, no toast for remote keys
            }
        } catch (error) {
            this.showToast('Failed to send remote key', 'error');
        }
    }

    // Settings Management
    loadSettings() {
        const apiUrlInput = document.getElementById('apiUrl');
        if (apiUrlInput) apiUrlInput.value = this.apiUrl;
    }

    saveApiUrl() {
        const apiUrlInput = document.getElementById('apiUrl');
        const newUrl = apiUrlInput.value.trim();

        this.apiUrl = newUrl;
        if (newUrl) {
            localStorage.setItem('vizioApiUrl', newUrl);
        } else {
            localStorage.removeItem('vizioApiUrl');
        }
        this.showToast('API URL saved', 'success');
    }

    resetSettings() {
        localStorage.removeItem('vizioApiUrl');
        this.apiUrl = '';
        document.getElementById('apiUrl').value = this.apiUrl;
        this.showToast('Settings reset', 'success');
    }

    refreshAllData() {
        this.refreshStatus();
        this.loadApps();
        this.showToast('Data refreshed', 'success');
    }

    // UI Helpers
    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.toggle('hidden', !show);
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // Service Worker for PWA
    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => console.log('SW registered:', registration))
                .catch(err => console.log('SW registration failed:', err));
        }
    }
}

// Global functions for HTML onclick handlers
function setPower(power) { app.setPower(power); }
function setVolume(volume) { app.setVolume(volume); }
function setMute(muted) { app.setMute(muted); }
function setInput(inputName) { app.setInput(inputName); }
function launchApp(appName) { app.launchApp(appName); }
function sendRemoteKey(key) { app.sendRemoteKey(key); }
function refreshStatus() { app.refreshStatus(); }
function testConnection() { app.testConnection(); }
function saveApiUrl() { app.saveApiUrl(); }
function resetSettings() { app.resetSettings(); }
function refreshAllData() { app.refreshAllData(); }
function togglePower() { app.togglePower(); }
function cycleSoundMode() { app.showToast('Sound mode cycling', 'info'); }

// Initialize
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new VizioTVController();
});

// PWA install prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

// Online/offline handling
window.addEventListener('online', () => {
    app.showToast('Back online', 'success');
});

window.addEventListener('offline', () => {
    app.showToast('No internet connection', 'error');
    app.updateConnectionStatus('Offline', false);
});

// Refresh on visibility change
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && app && app.isConnected) {
        app.refreshStatus();
    }
});
