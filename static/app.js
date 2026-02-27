// Vizio TV Controller Web App
class VizioTVController {
    constructor() {
        // Use localStorage override if set, otherwise same origin (empty string)
        this.apiUrl = localStorage.getItem('vizioApiUrl') || '';
        this.isConnected = false;
        this.tvInfo = null;
        this.init();
    }

    init() {
        this.setupTabNavigation();
        this.setupVolumeSlider();
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

                // Update active tab button
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                // Update active tab panel
                tabPanels.forEach(panel => panel.classList.remove('active'));
                document.getElementById(targetTab).classList.add('active');
            });
        });
    }

    // Volume Slider
    setupVolumeSlider() {
        const volumeSlider = document.getElementById('volumeSlider');
        const volumeValue = document.getElementById('volumeValue');

        volumeSlider.addEventListener('input', (e) => {
            const value = e.target.value;
            volumeValue.textContent = `${value}%`;
        });

        volumeSlider.addEventListener('change', (e) => {
            const value = parseInt(e.target.value);
            this.setVolume(value);
        });
    }

    // API Communication
    async makeApiRequest(endpoint, method = 'GET', data = null) {
        try {
            const url = `${this.apiUrl}${endpoint}`;
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                }
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

        statusText.textContent = text;
        statusDot.classList.toggle('connected', connected);
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
        document.getElementById('powerStatus').textContent = tvInfo.power || 'Unknown';
        document.getElementById('volumeStatus').textContent = `${tvInfo.volume || 0}%`;
        document.getElementById('inputStatus').textContent = tvInfo.input || 'Unknown';
        document.getElementById('muteStatus').textContent = tvInfo.muted ? 'Yes' : 'No';
        document.getElementById('currentInputDisplay').textContent = tvInfo.input || 'Unknown';

        // Update volume slider
        const volumeSlider = document.getElementById('volumeSlider');
        const volumeValue = document.getElementById('volumeValue');
        if (tvInfo.volume !== undefined) {
            volumeSlider.value = tvInfo.volume;
            volumeValue.textContent = `${tvInfo.volume}%`;
        }
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
                const icon = document.createElement('span');
                icon.className = 'icon';
                icon.textContent = '\uD83D\uDCFA';
                const label = document.createElement('span');
                label.className = 'label';
                label.textContent = appName;
                button.appendChild(icon);
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
                this.showToast(`Key '${key}' sent`, 'success');
            }
        } catch (error) {
            this.showToast('Failed to send remote key', 'error');
        }
    }

    // Settings Management
    loadSettings() {
        const apiUrlInput = document.getElementById('apiUrl');
        apiUrlInput.value = this.apiUrl;
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
        this.showToast('Data refreshed', 'success');
    }

    // UI Helpers
    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        overlay.classList.toggle('hidden', !show);
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        // Auto remove after 3 seconds
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // Service Worker for PWA
    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('SW registered: ', registration);
                })
                .catch(registrationError => {
                    console.log('SW registration failed: ', registrationError);
                });
        }
    }
}

// Global functions for HTML onclick handlers
function setPower(power) {
    app.setPower(power);
}

function setVolume(volume) {
    app.setVolume(volume);
}

function setMute(muted) {
    app.setMute(muted);
}

function setInput(inputName) {
    app.setInput(inputName);
}

function launchApp(appName) {
    app.launchApp(appName);
}

function sendRemoteKey(key) {
    app.sendRemoteKey(key);
}

function refreshStatus() {
    app.refreshStatus();
}

function testConnection() {
    app.testConnection();
}

function saveApiUrl() {
    app.saveApiUrl();
}

function resetSettings() {
    app.resetSettings();
}

function refreshAllData() {
    app.refreshAllData();
}

// Initialize the app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new VizioTVController();
});

// Handle install prompt for PWA
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Show install button if needed
    const installButton = document.createElement('button');
    installButton.textContent = 'Install App';
    installButton.className = 'btn-primary';
    installButton.onclick = () => {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            } else {
                console.log('User dismissed the install prompt');
            }
            deferredPrompt = null;
        });
    };

    // Add install button to settings if needed
    const settingsSection = document.querySelector('.settings-section:last-child');
    if (settingsSection) {
        settingsSection.appendChild(installButton);
    }
});

// Handle online/offline status
window.addEventListener('online', () => {
    app.showToast('Back online', 'success');
});

window.addEventListener('offline', () => {
    app.showToast('No internet connection', 'error');
    app.updateConnectionStatus('Offline', false);
});

// Handle visibility change for background refresh
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && app.isConnected) {
        app.refreshStatus();
    }
});
