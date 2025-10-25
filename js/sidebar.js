(function() {
    
class Sidebar {
    constructor() {
        this.ipcRenderer = require('electron').ipcRenderer;
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const homeIcon = document.querySelector('.nav-icon.home');
        const settingsIcon = document.querySelector('.nav-icon.settings');

        if (homeIcon) {
            homeIcon.addEventListener('click', () => this.handleHomeClick());
        }
        
        if (settingsIcon) {
            settingsIcon.addEventListener('click', () => this.handleSettingsClick());
        }
    }

    handleHomeClick() {
        location.reload();
    }

    handleSettingsClick() {
        this.openSettings();
    }

    openSettings() {
        this.ipcRenderer.send('open-settings');
    }

    // 可以添加更多导航功能的方法
    addNavigationItem(iconClass, title, clickHandler) {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;

        const navIcon = document.createElement('div');
        navIcon.className = `nav-icon ${iconClass}`;
        navIcon.title = title;
        navIcon.addEventListener('click', clickHandler);
        
        sidebar.appendChild(navIcon);
    }

    // 设置活动状态
    setActiveItem(itemClass) {
        const allIcons = document.querySelectorAll('.nav-icon');
        allIcons.forEach(icon => {
            icon.classList.remove('active');
        });

        const activeIcon = document.querySelector(`.nav-icon.${itemClass}`);
        if (activeIcon) {
            activeIcon.classList.add('active');
        }
    }

    destroy() {
        const homeIcon = document.querySelector('.nav-icon.home');
        const settingsIcon = document.querySelector('.nav-icon.settings');

        if (homeIcon) {
            homeIcon.removeEventListener('click', this.handleHomeClick);
        }
        
        if (settingsIcon) {
            settingsIcon.removeEventListener('click', this.handleSettingsClick);
        }
    }
}

module.exports = Sidebar;

})();