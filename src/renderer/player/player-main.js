// 播放器主入口文件 - 模块化重构
const PlayerController = require('./player-controller');
const UIController = require('./ui-controller');
const PlaybackManager = require('./playback-manager');
const SubtitleManager = require('./subtitle-manager');
const InputHandler = require('./input-handler');

class PlayerManager {
    constructor() {
        this.playerController = null;
        this.uiController = null;
        this.playbackManager = null;
        this.subtitleManager = null;
        this.inputHandler = null;
        
        this.initialize();
    }

    initialize() {
        try {
            console.log('初始化播放器管理器...');
            
            // 初始化各个模块
            this.playerController = new PlayerController();
            this.uiController = new UIController(this.playerController);
            this.playbackManager = new PlaybackManager(this.playerController);
            this.subtitleManager = new SubtitleManager(this.playerController);
            this.inputHandler = new InputHandler(this.playerController);
            
            // 绑定模块间依赖
            this.bindModuleDependencies();
            
            // 初始化UI组件
            this.uiController.initPlayButton();
            this.uiController.initVolumeButton();
            
            console.log('播放器管理器初始化完成');
        } catch (error) {
            console.error('播放器管理器初始化失败:', error);
            this.showError('播放器初始化失败: ' + error.message);
        }
    }

    bindModuleDependencies() {
        // 将模块绑定到playerController以便访问
        this.playerController.uiController = this.uiController;
        this.playerController.playbackManager = this.playbackManager;
        this.playerController.subtitleManager = this.subtitleManager;
        
        // 为playerController添加缺失的方法
        this.playerController.renderSeasonButtons = () => this.uiController.renderSeasonButtons();
        this.playerController.renderEpisodeButtons = () => this.uiController.renderEpisodeButtons();
        this.playerController.updatePlayPauseButton = () => this.uiController.updatePlayPauseButton();
        this.playerController.updateVolumeIcon = () => this.uiController.updateVolumeIcon();
        this.playerController.loadSeasons = () => this.uiController.loadSeasons();
        this.playerController.loadEpisodes = (season) => this.uiController.loadEpisodes(season);
        this.playerController.showError = (message) => this.uiController.showError(message);
        this.playerController.hideError = () => this.uiController.hideError();
        this.playerController.showLoading = () => this.uiController.showLoading();
        this.playerController.hideLoading = () => this.uiController.hideLoading();
        this.playerController.formatTime = (seconds) => this.uiController.formatTime(seconds);
        this.playerController.startMemoryMonitoring = () => this.uiController.startMemoryMonitoring();
        
        // 播放进度相关方法
        this.playerController.loadPlaybackProgress = () => this.playbackManager.loadPlaybackProgress();
        this.playerController.savePlaybackProgress = () => this.playbackManager.savePlaybackProgress();
        this.playerController.getPlaybackProgress = (videoPath) => this.playbackManager.getPlaybackProgress(videoPath);
        this.playerController.getEpisodeProgress = (episodePath) => this.playbackManager.getEpisodeProgress(episodePath);
        this.playerController.saveLastPlayedEpisode = () => this.playbackManager.saveLastPlayedEpisode();
        this.playerController.getLastPlayedEpisode = (tvShowPath) => this.playbackManager.getLastPlayedEpisode(tvShowPath);
        this.playerController.restorePlaybackProgress = () => this.playbackManager.restorePlaybackProgress();
        this.playerController.startProgressAutoSave = () => this.playbackManager.startProgressAutoSave();
        this.playerController.stopProgressAutoSave = () => this.playbackManager.stopProgressAutoSave();
        
        // 字幕相关方法
        this.playerController.loadSubtitles = () => this.subtitleManager.loadSubtitles();
        this.playerController.loadSubtitleSetting = () => this.subtitleManager.loadSubtitleSetting();
        this.playerController.applySubtitleSetting = (setting) => this.subtitleManager.applySubtitleSetting(setting);
    }

    // 窗口控制函数 - 暴露给HTML调用
    minimizeWindow() {
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('window-control', 'minimize');
    }

    toggleMaximizeWindow() {
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('window-control', 'toggle-maximize');
    }

    closeWindow() {
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('window-control', 'close');
    }

    // 播放控制函数 - 暴露给HTML调用
    playPause() {
        this.playerController.playPause();
    }

    prevEpisode() {
        this.playerController.prevEpisode();
    }

    nextEpisode() {
        this.playerController.nextEpisode();
    }

    toggleMute() {
        this.playerController.toggleMute();
    }

    setVolume(volume) {
        this.playerController.setVolume(volume);
    }

    toggleFullscreen() {
        this.playerController.toggleFullscreen();
    }

    seek(event) {
        this.playerController.seek(event);
    }

    fastForward() {
        this.playerController.fastForward();
    }

    rewind() {
        this.playerController.rewind();
    }

    // 字幕设置功能 - 暴露给HTML调用
    openSubtitleSettings() {
        this.subtitleManager.openSubtitleSettings();
    }

    openSpeedSettings() {
        this.subtitleManager.openSpeedSettings();
    }

    openAudioSettings() {
        this.subtitleManager.openAudioSettings();
    }

    // 清理方法
    cleanup() {
        console.log('清理播放器管理器资源...');
        
        // 清理各个模块
        if (this.playerController) {
            this.playerController.cleanup();
        }
        if (this.uiController) {
            this.uiController.cleanup();
        }
        if (this.playbackManager) {
            this.playbackManager.cleanup();
        }
        if (this.subtitleManager) {
            this.subtitleManager.cleanup();
        }
        if (this.inputHandler) {
            this.inputHandler.cleanup();
        }
        
        console.log('播放器管理器资源清理完成');
    }

    // 显示错误信息
    showError(message) {
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').textContent = message;
    }

    // 打开字幕设置
    openSubtitleSettings() {
        if (this.subtitleManager) {
            this.subtitleManager.openSubtitleSettings();
        } else {
            console.error('字幕管理器未初始化');
        }
    }

    // 打开速度设置（占位方法）
    openSpeedSettings() {
        console.log('打开速度设置（功能待实现）');
    }

    // 打开音频设置（占位方法）
    openAudioSettings() {
        console.log('打开音频设置（功能待实现）');
    }
}

// 全局错误处理
window.addEventListener('error', (event) => {
    console.error('全局错误:', event.error);
    document.getElementById('error').style.display = 'block';
    document.getElementById('error').textContent = '应用程序错误: ' + (event.error?.message || '未知错误');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的Promise拒绝:', event.reason);
    document.getElementById('error').style.display = 'block';
    document.getElementById('error').textContent = '应用程序错误: ' + (event.reason?.message || '未知Promise错误');
});

// 页面加载时初始化播放器管理器
document.addEventListener('DOMContentLoaded', function() {
    console.log('页面加载完成，初始化播放器管理器...');
    window.playerManager = new PlayerManager();
    
    // 页面卸载时清理资源
    window.addEventListener('beforeunload', () => {
        if (window.playerManager) {
            window.playerManager.cleanup();
        }
    });
});

// 导出类供测试使用
module.exports = PlayerManager;