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
        const sortIcon = document.querySelector('.nav-icon.sort');
        const settingsIcon = document.querySelector('.nav-icon.settings');

        if (homeIcon) {
            homeIcon.addEventListener('click', () => this.handleHomeClick());
        }
        
        if (sortIcon) {
            sortIcon.addEventListener('click', () => this.handleSortClick());
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

    handleSortClick() {
        this.toggleSortMenu();
    }

    toggleSortMenu() {
        // 切换排序菜单显示/隐藏
        const sortMenu = document.getElementById('sort-menu');
        if (sortMenu) {
            sortMenu.style.display = sortMenu.style.display === 'block' ? 'none' : 'block';
        } else {
            this.createSortMenu();
        }
    }

    createSortMenu() {
        // 创建排序菜单
        const sortMenu = document.createElement('div');
        sortMenu.id = 'sort-menu';
        sortMenu.className = 'sort-menu';
        sortMenu.innerHTML = `
            <div class="sort-option" data-sort="name-asc">
                <span class="sort-icon">A-Z</span>
                <span>按名称 (A-Z)</span>
            </div>
            <div class="sort-option" data-sort="name-desc">
                <span class="sort-icon">Z-A</span>
                <span>按名称 (Z-A)</span>
            </div>
            <div class="sort-option" data-sort="date-asc">
                <span class="sort-icon">📅 ↑</span>
                <span>按时间 (旧→新)</span>
            </div>
            <div class="sort-option" data-sort="date-desc">
                <span class="sort-icon">📅 ↓</span>
                <span>按时间 (新→旧)</span>
            </div>
        `;

        // 样式
        sortMenu.style.cssText = `
            position: fixed;
            top: 50%;
            left: 70px;
            transform: translateY(-50%);
            background: rgba(26, 26, 26, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 8px 0;
            backdrop-filter: blur(20px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            z-index: 1001;
            min-width: 180px;
            display: block;
        `;

        // 添加排序选项样式
        const style = document.createElement('style');
        style.textContent = `
            .sort-option {
                padding: 12px 16px;
                cursor: pointer;
                color: #ffffff;
                display: flex;
                align-items: center;
                gap: 12px;
                transition: all 0.2s ease;
                border-radius: 6px;
                margin: 2px 8px;
            }
            .sort-option:hover {
                background-color: rgba(255, 255, 255, 0.1);
            }
            .sort-option.active {
                background-color: rgba(0, 120, 212, 0.3);
                color: #0078d4;
            }
            .sort-icon {
                font-size: 14px;
                width: 20px;
                text-align: center;
            }
        `;
        document.head.appendChild(style);

        // 添加点击事件
        sortMenu.addEventListener('click', (event) => {
            const sortOption = event.target.closest('.sort-option');
            if (sortOption) {
                const sortType = sortOption.dataset.sort;
                this.handleSortChange(sortType);
                
                // 更新活动状态
                sortMenu.querySelectorAll('.sort-option').forEach(option => {
                    option.classList.remove('active');
                });
                sortOption.classList.add('active');
                
                // 关闭菜单
                setTimeout(() => {
                    sortMenu.style.display = 'none';
                }, 300);
            }
        });

        // 点击外部关闭菜单
        document.addEventListener('click', (event) => {
            if (!event.target.closest('.sort-menu') && !event.target.closest('.nav-icon.sort')) {
                if (sortMenu.style.display === 'block') {
                    sortMenu.style.display = 'none';
                }
            }
        });

        document.body.appendChild(sortMenu);
    }

    handleSortChange(sortType) {
        // 触发排序事件
        const event = new CustomEvent('sort-changed', {
            detail: { sortType }
        });
        document.dispatchEvent(event);
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