(function() {
    
class WindowControls {
    constructor() {
        this.ipcRenderer = require('electron').ipcRenderer;
        this.init();
    }

    init() {
        this.setupControls();
    }

    setupControls() {
        const minimizeBtn = document.querySelector('.minimize-btn');
        const maximizeBtn = document.querySelector('.maximize-btn');
        const closeBtn = document.querySelector('.close-btn');

        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => this.minimize());
        }
        
        if (maximizeBtn) {
            maximizeBtn.addEventListener('click', () => this.toggleMaximize());
        }
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }
    }

    minimize() {
        this.ipcRenderer.send('window-control', 'minimize');
    }

    toggleMaximize() {
        this.ipcRenderer.send('window-control', 'toggle-maximize');
    }

    close() {
        this.ipcRenderer.send('window-control', 'close');
    }

    updateMaximizeButton(isMaximized) {
        const maximizeBtn = document.querySelector('.maximize-btn');
        const icon = maximizeBtn?.querySelector('.control-icon');
        
        if (icon) {
            icon.textContent = isMaximized ? '❐' : '□';
        }
    }

    setupWindowStateListener() {
        // 监听窗口状态变化
        this.ipcRenderer.on('window-state-changed', (event, state) => {
            if (state.isMaximized !== undefined) {
                this.updateMaximizeButton(state.isMaximized);
            }
        });
    }

    destroy() {
        // 清理事件监听器
        const minimizeBtn = document.querySelector('.minimize-btn');
        const maximizeBtn = document.querySelector('.maximize-btn');
        const closeBtn = document.querySelector('.close-btn');

        if (minimizeBtn) {
            minimizeBtn.removeEventListener('click', this.minimize);
        }
        
        if (maximizeBtn) {
            maximizeBtn.removeEventListener('click', this.toggleMaximize);
        }
        
        if (closeBtn) {
            closeBtn.removeEventListener('click', this.close);
        }
    }
}

module.exports = WindowControls;

})();