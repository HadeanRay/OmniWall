(function() {
    
class Sidebar {
    constructor() {
        this.ipcRenderer = require('electron').ipcRenderer;
        this.currentView = 'local'; // 'local' 或 'bangumi'
        this.bangumiToken = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadBangumiToken();
    }

    setupEventListeners() {
        const homeIcon = document.querySelector('.nav-icon.home');
        const sortIcon = document.querySelector('.nav-icon.sort');
        const settingsIcon = document.querySelector('.nav-icon.settings');
        const bangumiIcon = document.querySelector('.nav-icon.bangumi');

        if (homeIcon) {
            homeIcon.addEventListener('click', () => this.handleHomeClick());
        }
        
        if (sortIcon) {
            sortIcon.addEventListener('click', () => this.handleSortClick());
        }
        
        if (settingsIcon) {
            settingsIcon.addEventListener('click', () => this.handleSettingsClick());
        }
        
        if (bangumiIcon) {
            bangumiIcon.addEventListener('click', () => this.handleBangumiClick());
        }
    }

    handleHomeClick() {
        location.reload();
    }

    handleSettingsClick() {
        this.openSettings();
    }

    openSettings() {
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('open-settings');
    }

    handleSortClick() {
        this.toggleSortMenu();
    }
    
    handleBangumiClick() {
        this.toggleBangumiView();
    }
    
    async loadBangumiToken() {
        try {
            // 从本地存储加载token
            const token = localStorage.getItem('bangumi_token');
            if (token) {
                this.bangumiToken = token;
                return;
            }
            
            // 如果本地存储中没有token，尝试从主进程获取
            const { ipcRenderer } = require('electron');
            
            // 创建Promise来处理异步获取设置
            const settings = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('获取设置超时'));
                }, 5000);
                
                ipcRenderer.once('settings-loaded', (event, settings) => {
                    clearTimeout(timeout);
                    resolve(settings);
                });
                
                ipcRenderer.send('load-settings');
            });
            
            if (settings.bangumiToken) {
                this.bangumiToken = settings.bangumiToken;
                localStorage.setItem('bangumi_token', settings.bangumiToken);
            }
        } catch (error) {
            console.error('加载Bangumi token失败:', error);
        }
    }
    
    async toggleBangumiView() {
        if (this.currentView === 'local') {
            // 切换到Bangumi视图
            if (!this.bangumiToken) {
                // 如果没有token，提示用户设置
                alert('请先在设置中配置Bangumi token');
                this.openSettings();
                return;
            }
            
            this.currentView = 'bangumi';
            this.setActiveItem('bangumi');
            await this.loadBangumiCollection();
        } else {
            // 切换回本地视图
            this.currentView = 'local';
            this.setActiveItem('home');
            this.loadLocalContent();
        }
    }
    
    async loadBangumiCollection() {
        try {
            // 显示加载状态
            const posterGrid = document.getElementById('posterGrid');
            const loading = document.getElementById('loading');
            const error = document.getElementById('error');
            const empty = document.getElementById('empty');
            
            if (posterGrid) posterGrid.style.display = 'none';
            if (error) error.style.display = 'none';
            if (empty) empty.style.display = 'none';
            if (loading) {
                loading.style.display = 'block';
                loading.textContent = '正在加载Bangumi收藏...';
            }
            
            // 首先尝试从本地缓存加载
            const cachedCollection = localStorage.getItem('bangumi_collection');
            const cacheTimestamp = localStorage.getItem('bangumi_collection_timestamp');
            const cacheTime = cacheTimestamp ? parseInt(cacheTimestamp) : 0;
            const currentTime = Date.now();
            const cacheExpiry = 30 * 60 * 1000; // 30分钟缓存
            
            let collection = null;
            
            // 如果缓存存在且未过期，使用缓存数据
            if (cachedCollection && (currentTime - cacheTime) < cacheExpiry) {
                console.log('使用缓存的Bangumi收藏数据');
                collection = JSON.parse(cachedCollection);
                // 渲染缓存内容
                this.renderBangumiContent(collection);
                // 在后台更新数据
                this.updateBangumiCollectionInBackground();
            } else {
                // 调用Bangumi API获取收藏
                collection = await this.fetchBangumiCollection();
                
                if (collection && collection.length > 0) {
                    // 缓存到本地
                    localStorage.setItem('bangumi_collection', JSON.stringify(collection));
                    localStorage.setItem('bangumi_collection_timestamp', currentTime.toString());
                    
                    // 渲染Bangumi内容
                    this.renderBangumiContent(collection);
                } else {
                    // 显示空状态
                    if (loading) loading.style.display = 'none';
                    if (empty) {
                        empty.style.display = 'block';
                        empty.querySelector('h2').textContent = '暂无收藏';
                        empty.querySelector('p').textContent = '在Bangumi上收藏一些电视剧或电影吧';
                        const setupBtn = empty.querySelector('.setup-btn');
                        if (setupBtn) {
                            setupBtn.textContent = '刷新';
                            setupBtn.onclick = () => this.loadBangumiCollection();
                        }
                    }
                }
            }
        } catch (error) {
            console.error('加载Bangumi收藏失败:', error);
            // 尝试使用缓存数据作为后备
            const cachedCollection = localStorage.getItem('bangumi_collection');
            if (cachedCollection) {
                console.log('使用缓存数据作为后备');
                const collection = JSON.parse(cachedCollection);
                this.renderBangumiContent(collection);
                // 显示缓存提示
                const loading = document.getElementById('loading');
                if (loading) {
                    loading.style.display = 'block';
                    loading.textContent = '⚠️ 使用缓存数据（网络连接失败）';
                    setTimeout(() => {
                        loading.style.display = 'none';
                    }, 3000);
                }
                return;
            }
            
            // 显示错误状态
            const loading = document.getElementById('loading');
            const errorEl = document.getElementById('error');
            if (loading) loading.style.display = 'none';
            if (errorEl) {
                errorEl.style.display = 'block';
                errorEl.textContent = '加载Bangumi收藏失败: ' + error.message;
            }
        }
    }
    
    // 在后台更新Bangumi收藏数据
    async updateBangumiCollectionInBackground() {
        try {
            const collection = await this.fetchBangumiCollection();
            if (collection && collection.length > 0) {
                // 更新本地缓存
                localStorage.setItem('bangumi_collection', JSON.stringify(collection));
                localStorage.setItem('bangumi_collection_timestamp', Date.now().toString());
                console.log('后台更新Bangumi收藏数据完成');
            }
        } catch (error) {
            console.error('后台更新Bangumi收藏失败:', error);
        }
    }
    
    /**
     * 缓存Bangumi海报到本地
     * @param {Array} collection - Bangumi收藏数据
     * @param {HTMLElement} container - 容器元素
     */
    async cacheBangumiPosters(collection, container) {
        console.log(`开始缓存 ${collection.length} 个Bangumi海报`);
        
        // 创建本地缓存目录
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const cacheDir = path.join(os.homedir(), '.omniwall', 'bangumi-cache');
        
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }
        
        // 逐个下载和缓存海报
        for (let i = 0; i < collection.length; i++) {
            const item = collection[i];
            if (item.poster) {
                try {
                    await this.cacheSinglePoster(item, cacheDir);
                    console.log(`缓存进度: ${i + 1}/${collection.length} (${Math.round((i + 1) / collection.length * 100)}%) - ${item.name}`);
                } catch (error) {
                    console.error(`缓存海报失败 ${item.name}:`, error.message);
                }
            }
            
            // 创建卡片并添加到容器
            const card = this.createBangumiCard(item);
            container.appendChild(card);
        }
        
        console.log('所有Bangumi海报缓存完成');
    }
    
    /**
     * 缓存单个海报到本地
     * @param {Object} item - Bangumi项目
     * @param {string} cacheDir - 缓存目录
     * @returns {Promise} 缓存完成的Promise
     */
    cacheSinglePoster(item, cacheDir) {
        return new Promise((resolve, reject) => {
            const https = require('https');
            const fs = require('fs');
            const path = require('path');
            
            // 生成本地文件名
            const fileName = `${item.id}.jpg`;
            const filePath = path.join(cacheDir, fileName);
            
            // 检查文件是否已存在
            if (fs.existsSync(filePath)) {
                // 更新项目海报路径为本地缓存路径
                item.localPosterPath = filePath;
                console.log(`海报已存在于本地缓存: ${item.name}`);
                resolve();
                return;
            }
            
            // 下载海报
            const file = fs.createWriteStream(filePath);
            const request = https.get(item.poster, (response) => {
                if (response.statusCode === 200) {
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        // 更新项目海报路径为本地缓存路径
                        item.localPosterPath = filePath;
                        console.log(`海报缓存成功: ${item.name} -> ${filePath}`);
                        resolve();
                    });
                } else {
                    fs.unlink(filePath, () => {}); // 删除部分下载的文件
                    reject(new Error(`HTTP ${response.statusCode}`));
                }
            });
            
            request.on('error', (error) => {
                fs.unlink(filePath, () => {}); // 删除部分下载的文件
                reject(error);
            });
        });
    }
    
    async fetchBangumiCollection() {
        // 通过IPC调用主进程的Bangumi API
        const { ipcRenderer } = require('electron');
        
        return new Promise((resolve, reject) => {
            // 监听响应
            ipcRenderer.once('bangumi-collection-loaded', (event, response) => {
                if (response.status === 'success') {
                    // 将Bangumi数据转换为应用内部格式
                    const processedCollection = this.processBangumiData(response.collection);
                    resolve(processedCollection);
                } else {
                    reject(new Error(response.message || '获取收藏失败'));
                }
            });
            
            // 发送请求
            ipcRenderer.send('bangumi-get-collection', {
                subject_type: 2, // 2表示动画/电视剧
                limit: 100,
                offset: 0
            });
        });
    }
    
    processBangumiData(collectionData) {
        // 将Bangumi API返回的数据转换为应用内部格式
        if (!collectionData) {
            return [];
        }
        
        // 根据API响应的格式处理数据
        let items = [];
        
        if (collectionData.data) {
            // 如果是分页格式 { data: [], total: N }
            items = collectionData.data;
        } else if (Array.isArray(collectionData)) {
            // 如果直接是数组
            items = collectionData;
        } else {
            // 其他格式
            return [];
        }
        
        return items.map(item => {
            const subject = item.subject || item;
            return {
                id: subject.id,
                name: subject.name || subject.name_cn || '未知标题',
                name_cn: subject.name_cn || subject.name,
                poster: subject.images?.large || subject.images?.medium || '',
                path: '', // Bangumi项目没有本地路径
                type: this.convertBangumiType(subject.type || subject.subject_type), // 1-书籍, 2-动画, 3-音乐, 4-游戏, 6-三次元
                rating: subject.rating?.score || item.rate || 0,
                summary: subject.summary || '暂无简介',
                eps: subject.eps || subject.total_episodes || 0,
                total_episodes: subject.total_episodes || subject.eps || 0,
                date: subject.date || subject.air_date || null, // 首播时间
                collection_type: item.type || item.collection?.type || null, // 收藏类型: 1-想看, 2-看过, 3-在看, 4-搁置, 5-抛弃
                user_comment: item.comment || item.collection?.comment || '',
                user_rate: item.rate || item.collection?.rate || 0,
                lasttouch: item.lasttouch || item.collection?.lasttouch || null
            };
        });
    }
    
    convertBangumiType(type) {
        // 将Bangumi类型转换为应用类型
        switch (type) {
            case 1: // 书籍
            case '1':
                return 'book';
            case 2: // 动画
            case '2':
                return 'tv'; // 动画通常包含电视剧
            case 3: // 音乐
            case '3':
                return 'music';
            case 4: // 游戏
            case '4':
                return 'game';
            case 6: // 三次元
            case '6':
                return 'movie'; // 实拍影视
            default:
                return 'tv';
        }
    }
    
    renderBangumiContent(collection) {
        const loading = document.getElementById('loading');
        
        if (loading) loading.style.display = 'none';
        
        // 获取PosterGrid实例
        const app = require('./app');
        const appInstance = app.initializeApp();
        const posterGridInstance = appInstance.components.posterGrid;
        
        if (posterGridInstance) {
            // 使用PosterGrid的专门方法更新Bangumi数据
            posterGridInstance.updateBangumiCollection(collection);
        } else {
            // 如果无法获取PosterGrid实例，使用直接渲染方式
            const posterGrid = document.getElementById('posterGrid');
            if (posterGrid) {
                posterGrid.style.display = 'grid';
                posterGrid.innerHTML = '';
                
                // 缓存海报并显示进度
                this.cacheBangumiPosters(collection, posterGrid);
            }
        }
    }
    
    /**
     * 缓存Bangumi海报到本地
     * @param {Array} collection - Bangumi收藏数据
     * @param {HTMLElement} container - 容器元素
     */
    async cacheBangumiPosters(collection, container) {
        console.log(`开始缓存 ${collection.length} 个Bangumi海报`);
        
        // 创建本地缓存目录
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const cacheDir = path.join(os.homedir(), '.omniwall', 'bangumi-cache');
        
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }
        
        // 逐个下载和缓存海报
        for (let i = 0; i < collection.length; i++) {
            const item = collection[i];
            if (item.poster) {
                try {
                    await this.cacheSinglePoster(item, cacheDir);
                    console.log(`缓存进度: ${i + 1}/${collection.length} (${Math.round((i + 1) / collection.length * 100)}%)`);
                } catch (error) {
                    console.error(`缓存海报失败 ${item.name}:`, error.message);
                }
            }
            
            // 创建卡片并添加到容器
            const card = this.createBangumiCard(item);
            container.appendChild(card);
        }
        
        console.log('所有Bangumi海报缓存完成');
    }
    
    /**
     * 缓存单个海报到本地
     * @param {Object} item - Bangumi项目
     * @param {string} cacheDir - 缓存目录
     * @returns {Promise} 缓存完成的Promise
     */
    cacheSinglePoster(item, cacheDir) {
        return new Promise((resolve, reject) => {
            const https = require('https');
            const fs = require('fs');
            const path = require('path');
            
            // 生成本地文件名
            const fileName = `${item.id}.jpg`;
            const filePath = path.join(cacheDir, fileName);
            
            // 检查文件是否已存在
            if (fs.existsSync(filePath)) {
                // 更新项目海报路径为本地缓存路径
                item.localPosterPath = filePath;
                resolve();
                return;
            }
            
            // 下载海报
            const file = fs.createWriteStream(filePath);
            const request = https.get(item.poster, (response) => {
                if (response.statusCode === 200) {
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        // 更新项目海报路径为本地缓存路径
                        item.localPosterPath = filePath;
                        resolve();
                    });
                } else {
                    fs.unlink(filePath, () => {}); // 删除部分下载的文件
                    reject(new Error(`HTTP ${response.statusCode}`));
                }
            });
            
            request.on('error', (error) => {
                fs.unlink(filePath, () => {}); // 删除部分下载的文件
                reject(error);
            });
        });
    }
    
    createBangumiCard(item) {
        const card = document.createElement('div');
        card.className = 'poster-card';
        
        const img = document.createElement('img');
        img.className = 'poster-image';
        img.alt = item.name;
        
        // 使用本地缓存的海报路径，如果不存在则使用原始URL
        if (item.localPosterPath) {
            img.src = `file://${item.localPosterPath}`;
        } else if (item.poster) {
            img.src = item.poster;
        } else {
            img.style.background = 'linear-gradient(135deg, #2a2a2a, #404040)';
            img.style.display = 'flex';
            img.style.alignItems = 'center';
            img.style.justifyContent = 'center';
            img.style.color = 'rgba(255, 255, 255, 0.6)';
            img.style.fontSize = '14px';
            img.style.fontWeight = '500';
            img.textContent = item.type === 'movie' ? '电影' : '电视剧';
        }
        
        const button = document.createElement('button');
        button.className = 'poster-button';
        button.textContent = item.name_cn || item.name;
        
        // 添加额外信息显示
        const infoDiv = document.createElement('div');
        infoDiv.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            font-size: 10px;
            padding: 2px 4px;
            border-radius: 3px;
            z-index: 2;
        `;
        
        // 显示评分
        if (item.rating && item.rating > 0) {
            infoDiv.textContent = `★${item.rating.toFixed(1)}`;
        } else {
            infoDiv.textContent = '暂无评分';
        }
        
        // 添加点击事件
        card.addEventListener('click', () => {
            // TODO: 实现播放功能
            alert(`点击了: ${item.name_cn || item.name}\n类型: ${item.type}\n评分: ${item.rating || '暂无'}\n集数: ${item.eps || item.total_episodes || '未知'}`);
        });
        
        card.appendChild(img);
        card.appendChild(button);
        card.appendChild(infoDiv);
        
        return card;
    }
    
    loadLocalContent() {
        // 重新加载本地内容
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('scan-tv-shows');
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