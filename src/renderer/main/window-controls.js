(function() {
    
class WindowControls {
    constructor() {
        this.ipcRenderer = require('electron').ipcRenderer;
        this.minimizeBtn = null;
        this.maximizeBtn = null;
        this.closeBtn = null;
        this.windowState = {
            isMaximized: false
        };
        this.init();
    }

    init() {
        this.cacheElements();
        this.setupEventListeners();
        this.setupWindowStateListener();
    }

    cacheElements() {
        this.minimizeBtn = document.querySelector('.minimize-btn');
        this.maximizeBtn = document.querySelector('.maximize-btn');
        this.closeBtn = document.querySelector('.close-btn');
    }

    setupEventListeners() {
        if (this.minimizeBtn) {
            this.minimizeBtn.addEventListener('click', this.handleMinimize.bind(this));
        }
        
        if (this.maximizeBtn) {
            this.maximizeBtn.addEventListener('click', this.handleMaximize.bind(this));
        }
        
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', this.handleClose.bind(this));
        }
    }

    handleMinimize() {
        this.ipcRenderer.send('window-control', 'minimize');
    }

    handleMaximize() {
        this.ipcRenderer.send('window-control', 'toggle-maximize');
    }

    handleClose() {
        this.ipcRenderer.send('window-control', 'close');
    }

    updateMaximizeButton(isMaximized) {
        if (!this.maximizeBtn) return;
        
        const icon = this.maximizeBtn.querySelector('.control-icon');
        if (icon) {
            // 对于SVG图标，我们不需要更新内容，而是可能需要更新样式或属性
            // 如果需要根据窗口状态更改外观，可以添加CSS类
            this.maximizeBtn.classList.toggle('maximized', isMaximized);
        }
        
        // 更新内部状态
        this.windowState.isMaximized = isMaximized;
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
        if (this.minimizeBtn) {
            this.minimizeBtn.removeEventListener('click', this.handleMinimize);
        }
        
        if (this.maximizeBtn) {
            this.maximizeBtn.removeEventListener('click', this.handleMaximize);
        }
        
        if (this.closeBtn) {
            this.closeBtn.removeEventListener('click', this.handleClose);
        }
    }
}

module.exports = WindowControls;

})();