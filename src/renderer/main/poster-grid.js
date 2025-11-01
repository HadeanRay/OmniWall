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

        updateDebugInfo() {
            this.utils.updateDebugInfo();
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
            this.utils.handleSortChange(sortType);
        }

        updateTvShows(tvShows) {
            this.tvShows = tvShows;
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
        }
    }

    module.exports = PosterGrid;
})();