(function() {
    
const PosterGrid = require('./poster-grid');
const WindowControls = require('./window-controls');
const Sidebar = require('./sidebar');
const StateManager = require('./state-manager');

class OmniWallApp {
    constructor() {
        this.components = {};
        this.init();
    }

    init() {
        console.log('OmniWall 应用初始化中...');
        
        try {
            this.initializeComponents();
            this.setupEventListeners();
            this.startScanning();
            
            console.log('OmniWall 应用初始化完成');
        } catch (error) {
            console.error('应用初始化失败:', error);
        }
    }

    initializeComponents() {
        // 初始化状态管理器
        this.components.stateManager = new StateManager();
        
        // 初始化窗口控制
        this.components.windowControls = new WindowControls();
        // 设置窗口状态监听器
        this.components.windowControls.setupWindowStateListener();
        
        // 初始化海报网格
        this.components.posterGrid = new PosterGrid('posterGrid');
        
        // 初始化侧边栏
        this.components.sidebar = new Sidebar();
    }

    setupEventListeners() {
        // 监听状态变化
        document.addEventListener('state-changed', (event) => {
            this.handleStateChange(event.detail.oldState, event.detail.newState);
        });

        // 监听页面加载完成
        document.addEventListener('DOMContentLoaded', () => {
            this.onDomReady();
        });
        
        // 监听设置加载完成事件，用于Sidebar更新token
        const { ipcRenderer } = require('electron');
        ipcRenderer.on('settings-loaded', (event, settings) => {
            if (this.components.sidebar && settings.bangumiToken) {
                this.components.sidebar.bangumiToken = settings.bangumiToken;
                localStorage.setItem('bangumi_token', settings.bangumiToken);
            }
        });
        
        
    }

    handleStateChange(oldState, newState) {
        // 处理状态变化，协调各个组件
        if (newState.isLoading !== oldState.isLoading) {
            this.handleLoadingState(newState.isLoading);
        }
        
        if (newState.error !== oldState.error) {
            this.handleErrorState(newState.error);
        }
        
        if (newState.isEmpty !== oldState.isEmpty) {
            this.handleEmptyState(newState.isEmpty);
        }
        
        if (newState.tvShows !== oldState.tvShows) {
            this.handleTvShowsChange(newState.tvShows);
        }
    }

    handleLoadingState(isLoading) {
        // 可以在这里添加加载状态的处理逻辑
        console.log('加载状态:', isLoading ? '开始加载' : '加载完成');
    }

    handleErrorState(error) {
        // 可以在这里添加错误状态的处理逻辑
        if (error) {
            console.error('发生错误:', error);
        }
    }

    handleEmptyState(isEmpty) {
        // 可以在这里添加空状态的处理逻辑
        if (isEmpty) {
            console.log('没有找到电视剧');
        }
    }

    handleTvShowsChange(tvShows) {
        // 可以在这里添加电视剧数据变化的处理逻辑
        console.log('电视剧数据已更新，数量:', tvShows.length);
    }

    onDomReady() {
        console.log('DOM 已加载完成');
        
        // 延迟启动扫描，确保所有组件都已初始化
        setTimeout(() => {
            this.startScanning();
        }, 100);
    }

    startScanning() {
        console.log('开始扫描电视剧...');
        this.components.stateManager.scanTvShows();
    }

    // 重新扫描
    rescan() {
        this.components.stateManager.reset();
        this.startScanning();
    }

    // 销毁应用
    destroy() {
        Object.values(this.components).forEach(component => {
            if (component.destroy) {
                component.destroy();
            }
        });
        
        // 清理事件监听器
        document.removeEventListener('state-changed', this.handleStateChange);
        document.removeEventListener('DOMContentLoaded', this.onDomReady);
        
        console.log('OmniWall 应用已销毁');
    }
    
    
}

// 创建全局应用实例
let appInstance = null;

function initializeApp() {
    if (!appInstance) {
        appInstance = new OmniWallApp();
    }
    return appInstance;
}

module.exports = {
    OmniWallApp,
    initializeApp
};

})();