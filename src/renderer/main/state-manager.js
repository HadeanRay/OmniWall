(function() {
    
class StateManager {
    constructor() {
        this.ipcRenderer = require('electron').ipcRenderer;
        this.currentState = {
            tvShows: [],
            isLoading: true,
            error: null,
            isEmpty: false
        };
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.ipcRenderer.on('tv-shows-scanned', (event, data) => {
            this.handleTvShowsData(data);
        });

        // 设置页面加载后处理空状态按钮
        document.addEventListener('DOMContentLoaded', () => {
            const setupBtn = document.getElementById('setup-btn');
            if (setupBtn) {
                setupBtn.addEventListener('click', () => {
                    this.openSettings();
                });
            }
        });
    }

    openSettings() {
        this.ipcRenderer.send('open-settings');
    }

    handleTvShowsData(data) {
        if (data.error) {
            this.updateState({
                tvShows: [],
                isLoading: false,
                error: data.error,
                isEmpty: false
            });
        } else {
            const tvShows = data.tvShows || [];
            this.updateState({
                tvShows: tvShows,
                isLoading: false,
                error: null,
                isEmpty: tvShows.length === 0
            });
        }
    }

    updateState(newState) {
        const oldState = { ...this.currentState };
        this.currentState = { ...this.currentState, ...newState };
        
        // 触发状态变化事件
        this.notifyStateChange(oldState, this.currentState);
    }

    notifyStateChange(oldState, newState) {
        // 这里可以添加状态变化时的回调处理
        // 例如：更新UI组件、触发重新渲染等
        const event = new CustomEvent('state-changed', {
            detail: {
                oldState,
                newState
            }
        });
        document.dispatchEvent(event);
    }

    getState() {
        return { ...this.currentState };
    }

    getTvShows() {
        return [...this.currentState.tvShows];
    }

    isLoading() {
        return this.currentState.isLoading;
    }

    hasError() {
        return this.currentState.error !== null;
    }

    getError() {
        return this.currentState.error;
    }

    isEmpty() {
        return this.currentState.isEmpty;
    }

    // 扫描电视剧
    scanTvShows() {
        this.updateState({
            isLoading: true,
            error: null,
            isEmpty: false
        });
        this.ipcRenderer.send('scan-tv-shows');
    }

    // 重置状态
    reset() {
        this.updateState({
            tvShows: [],
            isLoading: true,
            error: null,
            isEmpty: false
        });
    }

    destroy() {
        // 清理事件监听器
        this.ipcRenderer.removeAllListeners('tv-shows-scanned');
    }
}

module.exports = StateManager;

})();