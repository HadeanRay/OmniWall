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
            
            // 设置默认显示模式
            if (!this.displayMode) {
                this.displayMode = 'local';
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
            // 清除缓存的循环距离，因为排序改变会导致布局变化
            this.cachedCycleDistance = null;
            
            // 使用预计算的骨架屏结构更新网格
            this.updateGridWithSkeletonStructure();
        }

        updateTvShows(tvShows) {
            this.tvShows = tvShows;
            
            // 预加载图片以提高初始加载体验
            this.preloadImages(tvShows);
            
            // 使用预计算的骨架屏结构更新网格
            this.updateGridWithSkeletonStructure();
        }
        
        /**
         * 更新当前显示模式（本地或Bangumi）
         * @param {string} mode - 显示模式: 'local' 或 'bangumi'
         */
        updateDisplayMode(mode) {
            this.displayMode = mode;
            
            // 使用预计算的骨架屏结构更新网格
            this.updateGridWithSkeletonStructure();
            
            // 重新计算无限滑动所需的结构
            this.recalculateInfiniteScrollStructure();
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
            
            // 使用预计算的骨架屏结构更新网格
            this.updateGridWithSkeletonStructure();
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
        
        /**
         * 重新计算无限滑动所需的结构
         */
        recalculateInfiniteScrollStructure() {
            // 清除缓存的循环距离，因为结构变化需要重新计算
            this.cachedCycleDistance = null;
            
            // 如果已经初始化了GSAP和图片数据，重新初始化位置
            if (this.gsap && this.img_data && this.img_data.length > 0) {
                this.sizeCalculator.initImagePositions();
            }
        }
        
        /**
         * 预计算完整的骨架屏结构并更新网格
         */
        updateGridWithSkeletonStructure() {
            // 预计算完整的骨架屏结构
            if (this.renderer && typeof this.renderer.precomputeSkeletonStructure === 'function') {
                console.log('预计算骨架屏结构...');
                const skeletonStructure = this.renderer.precomputeSkeletonStructure();
                console.log(`预计算完成，结构包含 ${skeletonStructure.length} 个项目`);
            }
            
            // 更新网格
            this.renderGrid();
        }
    }

    module.exports = PosterGrid;
})();