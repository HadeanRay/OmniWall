(function() {
    
class Sidebar {
    constructor() {
        this.ipcRenderer = require('electron').ipcRenderer;
        // 缓存DOM元素引用
        this.sortIcon = null;
        this.settingsIcon = null;
        this.init();
    }

    init() {
        this.cacheElements();
        this.setupEventListeners();
    }

    cacheElements() {
        this.sortIcon = document.querySelector('.nav-icon.sort');
        this.settingsIcon = document.querySelector('.nav-icon.settings');
    }

    setupEventListeners() {
        if (this.sortIcon) {
            this.sortIcon.addEventListener('click', this.handleSortClick.bind(this));
        }
        
        if (this.settingsIcon) {
            this.settingsIcon.addEventListener('click', this.handleSettingsClick.bind(this));
        }
    }

    handleHomeClick() {
        // 切换本地和Bangumi视图（仅使用本地缓存）
        this.toggleContentView();
    }

    handleSettingsClick() {
        this.openSettings();
    }

    openSettings() {
        this.ipcRenderer.send('open-settings');
    }

    handleSortClick() {
        this.toggleSortMenu();
    }
    
    toggleContentView() {
        // TODO: 实现切换内容视图功能
    }
    
    toggleSortMenu() {
        // TODO: 实现切换排序菜单功能
    }
}

module.exports = Sidebar;

})();