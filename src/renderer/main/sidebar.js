(function() {
    
class Sidebar {
    constructor() {
        this.ipcRenderer = require('electron').ipcRenderer;
        // 缓存DOM元素引用
        this.sortIcon = null;
        this.settingsIcon = null;
        this.sortMenu = null;
        this.init();
    }

    init() {
        this.cacheElements();
        this.setupEventListeners();
        this.createSortMenu();
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
        
        // 点击其他地方关闭排序菜单
        document.addEventListener('click', (event) => {
            if (this.sortMenu && this.sortMenu.style.display === 'block' && 
                !this.sortIcon.contains(event.target) && 
                !this.sortMenu.contains(event.target)) {
                this.hideSortMenu();
            }
        });
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
        if (this.sortMenu.style.display === 'block') {
            this.hideSortMenu();
        } else {
            this.showSortMenu();
        }
    }
    
    showSortMenu() {
        // 定位排序菜单在排序图标右边
        const rect = this.sortIcon.getBoundingClientRect();
        this.sortMenu.style.left = (rect.right + 5) + 'px';
        this.sortMenu.style.top = (rect.top) + 'px';
        this.sortMenu.style.display = 'block';
    }
    
    hideSortMenu() {
        this.sortMenu.style.display = 'none';
    }
    
    createSortMenu() {
        // 创建排序菜单
        this.sortMenu = document.createElement('div');
        this.sortMenu.className = 'sort-menu';
        this.sortMenu.style.cssText = `
            position: fixed;
            display: none;
            background-color: rgba(26, 26, 26, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            padding: 8px 0;
            z-index: 1001;
            backdrop-filter: blur(10px);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            min-width: 180px;
        `;
        
        // 添加排序选项
        const sortOptions = [
            { value: 'name-asc', label: '名称升序' },
            { value: 'name-desc', label: '名称降序' },
            { value: 'date-asc', label: '日期升序' },
            { value: 'date-desc', label: '日期降序' }
        ];
        
        sortOptions.forEach(option => {
            const item = document.createElement('div');
            item.className = 'sort-option';
            item.textContent = option.label;
            item.style.cssText = `
                padding: 10px 16px;
                cursor: pointer;
                color: #FFFFFF;
                font-size: 14px;
                transition: background-color 0.2s;
            `;
            
            item.addEventListener('click', () => {
                this.selectSortOption(option.value);
            });
            
            item.addEventListener('mouseenter', () => {
                item.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            });
            
            item.addEventListener('mouseleave', () => {
                item.style.backgroundColor = 'transparent';
            });
            
            this.sortMenu.appendChild(item);
        });
        
        // 将排序菜单添加到文档中
        document.body.appendChild(this.sortMenu);
    }
    
    selectSortOption(sortType) {
        // 触发排序变化事件
        const event = new CustomEvent('sort-changed', {
            detail: { sortType }
        });
        document.dispatchEvent(event);
        
        // 隐藏排序菜单
        this.hideSortMenu();
    }
}

module.exports = Sidebar;

})();