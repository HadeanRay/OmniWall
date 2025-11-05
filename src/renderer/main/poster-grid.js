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
            this.gsap = null; // GSAP动画库
            
            // 排序相关
            this.currentSortType = 'name-asc'; // 默认排序方式
            
            // 图片缓存相关
            this.imageCache = new Map(); // 图片缓存
            
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

        // 直接访问模块方法而不是创建委托方法
        renderGrid() {
            this.renderer.renderGrid();
        }

        updatePosterSize() {
            this.sizeCalculator.updatePosterSize();
        }

        initImagePositions() {
            this.sizeCalculator.initImagePositions();
        }

        handleTvShowsScanned(data) {
            this.utils.handleTvShowsScanned(data);
        }

        handleSortChange(sortType) {
            // 更新当前排序类型
            this.currentSortType = sortType;
            
            // 更新网格
            this.renderGrid();
        }

        updateTvShows(tvShows) {
            this.tvShows = tvShows;
            
            // 预加载图片以提高初始加载体验
            this.preloadImages(tvShows);
            
            // 更新网格
            this.renderGrid();
        }
        
        /**
         * 更新当前显示模式（本地或Bangumi）
         * @param {string} mode - 显示模式: 'local' 或 'bangumi'
         */
        updateDisplayMode(mode) {
            this.currentDisplayMode = mode;
            // 重新渲染网格
            this.renderGrid();
        }

        /**
         * 更新Bangumi收藏数据
         * @param {Array} bangumiCollection - Bangumi收藏数据
         */
        updateBangumiCollection(bangumiCollection) {
            this.bangumiCollection = bangumiCollection;
            // 重新渲染网格
            this.renderGrid();
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
            
            this.container.innerHTML = '';
            this.tvShows = [];
            
            // 清理图片缓存
            this.clearImageCache();
        }
        
        /**
         * 清理图片缓存
         */
        clearImageCache() {
            // 清理图片缓存以释放内存
            this.imageCache.clear();
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