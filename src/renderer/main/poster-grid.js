
(function() {
    // 引入模块
    const InfiniteScroll = require('./modules/infinite-scroll');
    const EventHandlers = require('./modules/event-handlers');
    const Renderer = require('./modules/renderer');
    const GroupingSorting = require('./modules/grouping-sorting');
    const SizeCalculator = require('./modules/size-calculator');
    const Utils = require('./modules/utils');
    const GsapLoader = require('./modules/gsap-loader');

    // PosterGrid 类 - 管理电视剧海报网格显示
    class PosterGrid {
        constructor(containerId) {
            this.container = document.getElementById(containerId);
            this.tvShows = [];
            this.optimalRows = 2; // 默认2行
            this.scrollAnimationId = null;
            
            // 无限滑动相关属性
            this.if_movable = false;
            this.mouse_x = 0;
            this.mouse_y = 0;
            this.container_width = 0;
            this.container_height = 0;
            this.poster_width = 0;
            this.poster_height = 0;
            this.scale_nums = 1;
            this.standard_width = 1440;
            this.img_data = []; // 存储每个海报的位置数据
            this.gsap = null; // GSAP动画库
            
            // 排序相关
            this.currentSortType = 'name-asc'; // 默认排序方式
            
            // 分组相关
            this.groupedTvShows = []; // 存储分组后的电视剧数据
            
            // 图片缓存相关
            this.imageCache = new Map(); // 图片缓存
            this.cachedCycleDistance = null; // 缓存的循环距离
            
            // 虚拟滚动相关
            this.currentPage = 0;
            this.itemsPerPage = 0;
            this.totalItems = 0;
            this.allItemsToRender = null;
            this.currentStartIndex = 0;
            this.currentEndIndex = 0;
            
            // 初始化模块
            this.infiniteScroll = new InfiniteScroll(this);
            this.eventHandlers = new EventHandlers(this);
            this.renderer = new Renderer(this);
            this.groupingSorting = new GroupingSorting(this);
            this.sizeCalculator = new SizeCalculator(this);
            this.utils = new Utils(this);
            this.gsapLoader = new GsapLoader(this);
            
            this.init();
        }

        init() {
            if (!this.container) {
                console.error('海报网格容器未找到:', this.containerId);
                return;
            }
            
            // 加载GSAP库
            this.gsapLoader.loadGSAP().then(() => {
                this.eventHandlers.setupEventListeners();
                this.eventHandlers.setupResizeListener();
                this.infiniteScroll.setupInfiniteScrollListeners(); // 替换滚轮事件为无限滑动
                this.sizeCalculator.updatePosterSize(); // 初始化尺寸
            }).catch(error => {
                console.error('加载GSAP失败，使用默认滚动:', error);
                this.eventHandlers.setupEventListeners();
                this.eventHandlers.setupResizeListener();
                this.infiniteScroll.setupWheelListener(); // 回退到原始滚轮事件
                this.sizeCalculator.updatePosterSize(); // 初始化尺寸
            });
        }

        // 委托方法 - 无限滚动相关
        setupInfiniteScrollListeners() {
            this.infiniteScroll.setupInfiniteScrollListeners();
        }

        handleInfiniteScroll(clientX, clientY) {
            this.infiniteScroll.handleInfiniteScroll(clientX, clientY);
        }

        handleInfiniteWheelScroll(scrollDistance) {
            this.infiniteScroll.handleInfiniteWheelScroll(scrollDistance);
        }

        setupWheelListener() {
            this.infiniteScroll.setupWheelListener();
        }

        smoothScroll(scrollContainer, deltaX) {
            this.infiniteScroll.smoothScroll(scrollContainer, deltaX);
        }

        // 委托方法 - 事件处理相关
        setupEventListeners() {
            this.eventHandlers.setupEventListeners();
        }

        setupResizeListener() {
            this.eventHandlers.setupResizeListener();
        }

        // 委托方法 - 渲染相关
        createPosterCard(tvShow) {
            return this.renderer.createPosterCard(tvShow);
        }

        createGroupTitle(title) {
            return this.renderer.createGroupTitle(title);
        }

        renderGrid() {
            this.renderer.renderGrid();
        }

        // 委托方法 - 分组和排序相关
        sortTvShows(tvShows) {
            return this.groupingSorting.sortTvShows(tvShows);
        }

        getTvShowModifyTime(tvShow) {
            return this.groupingSorting.getTvShowModifyTime(tvShow);
        }

        getTvShowSeasonsCount(tvShow) {
            return this.groupingSorting.getTvShowSeasonsCount(tvShow);
        }

        groupTvShows(tvShows) {
            return this.groupingSorting.groupTvShows(tvShows);
        }

        // 委托方法 - 尺寸计算相关
        updatePosterSize() {
            this.sizeCalculator.updatePosterSize();
        }

        initImagePositions() {
            this.sizeCalculator.initImagePositions();
        }

        // 委托方法 - 工具函数相关
        getPinyinFirstLetter(str) {
            return this.utils.getPinyinFirstLetter(str);
        }

        adjustFontSize(button) {
            this.utils.adjustFontSize(button);
        }

        showError(message) {
            this.utils.showError(message);
        }

        showEmptyState() {
            this.utils.showEmptyState();
        }

        hideLoading() {
            this.utils.hideLoading();
        }

        playTvShow(tvShow) {
            this.utils.playTvShow(tvShow);
        }

        handleTvShowsScanned(data) {
            this.utils.handleTvShowsScanned(data);
        }

        handleSortChange(sortType) {
            // 清除缓存的循环距离，因为排序改变会导致布局变化
            this.cachedCycleDistance = null;
            
            this.utils.handleSortChange(sortType);
        }

        updateTvShows(tvShows) {
            this.tvShows = tvShows;
            
            // 预加载图片以提高初始加载体验
            this.preloadImages(tvShows);
            
            this.renderGrid();
        }

        /**
         * 更新Bangumi收藏数据
         * @param {Array} bangumiCollection - Bangumi收藏数据
         */
        updateBangumiCollection(bangumiCollection) {
            // 转换Bangumi数据格式以匹配本地电视剧格式
            this.tvShows = bangumiCollection.map(item => {
                return {
                    id: item.id,
                    name: item.name_cn || item.name,
                    path: '', // Bangumi项目没有本地路径
                    poster: item.poster,
                    localPosterPath: item.localPosterPath, // 本地缓存路径
                    type: item.type,
                    rating: item.rating,
                    summary: item.summary,
                    seasons: [], // Bangumi数据不包含季信息
                    firstEpisode: null, // Bangumi数据不包含本地文件信息
                    premiered: null, // 本地电视剧使用premiered字段
                    date: item.date || null // Bangumi数据使用date字段表示首播时间
                };
            });
            
            // 缓存海报
            this.cacheBangumiPosters(bangumiCollection);
            
            this.renderGrid();
        }
        
        /**
         * 缓存Bangumi海报到本地
         * @param {Array} collection - Bangumi收藏数据
         */
        async cacheBangumiPosters(collection) {
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
                if (item.poster && !item.localPosterPath) {
                    try {
                        await this.cacheSinglePoster(item, cacheDir);
                        console.log(`缓存进度: ${i + 1}/${collection.length} (${Math.round((i + 1) / collection.length * 100)}%) - ${item.name}`);
                    } catch (error) {
                        console.error(`缓存海报失败 ${item.name}:`, error.message);
                    }
                }
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

        clear() {
            this.tvShows = [];
            this.container.innerHTML = '';
            
            const loading = document.getElementById('loading');
            const error = document.getElementById('error');
            const empty = document.getElementById('empty');
            
            if (loading) loading.style.display = 'block';
            if (error) error.style.display = 'none';
            if (empty) empty.style.display = 'none';
            
            // 清理图片缓存
            this.clearImageCache();
        }

        destroy() {
            // 清理所有动画和定时器
            if (this.scrollAnimationId) {
                cancelAnimationFrame(this.scrollAnimationId);
                this.scrollAnimationId = null;
            }
            
            // 清理GSAP动画
            if (this.gsap && this.img_data) {
                this.img_data.forEach(img => {
                    if (img.ani) {
                        img.ani.kill();
                    }
                });
            }
            
            this.container.innerHTML = '';
            this.tvShows = [];
            this.img_data = [];
            
            // 清理图片缓存
            this.clearImageCache();
        }
        
        /**
         * 清理图片缓存
         */
        clearImageCache() {
            // 清理图片缓存以释放内存
            this.imageCache.clear();
            this.cachedCycleDistance = null;
            
            // 重置虚拟滚动相关属性
            this.currentPage = 0;
            this.itemsPerPage = 0;
            this.totalItems = 0;
            this.allItemsToRender = null;
            this.currentStartIndex = 0;
            this.currentEndIndex = 0;
        }
        
        /**
         * 预加载图片
         * @param {Array} tvShows - 电视剧列表
         */
        preloadImages(tvShows) {
            // 预加载前几个海报图片以提高初始加载体验
            const preloadCount = Math.min(10, tvShows.length);
            for (let i = 0; i < preloadCount; i++) {
                const tvShow = tvShows[i];
                if (tvShow.poster || tvShow.localPosterPath) {
                    const imgSrc = tvShow.localPosterPath ? 
                        `file://${tvShow.localPosterPath}` : 
                        (tvShow.path ? `file://${tvShow.poster}` : tvShow.poster);
                    
                    // 检查缓存中是否已有该图片
                    if (!this.imageCache.has(imgSrc)) {
                        // 创建图片对象进行预加载
                        const img = new Image();
                        img.src = imgSrc;
                        img.onload = () => {
                            // 图片加载成功后缓存
                            this.imageCache.set(imgSrc, true);
                            console.log(`预加载图片成功: ${imgSrc}`);
                        };
                        img.onerror = () => {
                            console.warn(`预加载图片失败: ${imgSrc}`);
                        };
                    }
                }
            }
        }
    }

    module.exports = PosterGrid;
})();