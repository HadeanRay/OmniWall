class PlaybackManager {
    constructor(playerController) {
        this.playerController = playerController;
        this.playbackProgress = {};
        this.currentVideoPath = '';
        this.progressSaveTimer = null;
        this.lastPlayedSeason = null;
        this.lastPlayedEpisode = null;
        this.targetEpisode = null;
        
        this.initialize();
    }

    initialize() {
        // 加载播放进度设置
        this.loadPlaybackProgress();
        
        // 绑定IPC事件
        const { ipcRenderer } = require('electron');
        ipcRenderer.on('playback-progress-loaded', (event, data) => {
            this.onPlaybackProgressLoaded(data);
        });
        
        ipcRenderer.on('last-played-loaded', (event, data) => {
            this.onLastPlayedLoaded(data);
        });
        
        console.log('播放进度管理器初始化完成');
    }

    // 加载播放进度
    loadPlaybackProgress() {
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('load-playback-progress');
    }

    // 保存播放进度
    savePlaybackProgress() {
        if (this.currentVideoPath && this.playerController.videoPlayer && this.playerController.videoPlayer.duration > 0) {
            const currentTime = this.playerController.videoPlayer.currentTime;
            const duration = this.playerController.videoPlayer.duration;
            const progress = {
                currentTime: currentTime,
                duration: duration,
                progress: currentTime / duration,
                timestamp: Date.now()
            };
            
            this.playbackProgress[this.currentVideoPath] = progress;
            
            // 保存到设置文件
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('save-playback-progress', {
                videoPath: this.currentVideoPath,
                progress: progress
            });
            
            console.log(`保存播放进度: ${this.currentVideoPath} - ${this.formatTime(currentTime)} / ${this.formatTime(duration)}`);
            
            // 重新渲染集按钮以更新播放进度状态
            this.playerController.renderEpisodeButtons();
        }
    }

    // 获取播放进度
    getPlaybackProgress(videoPath) {
        return this.playbackProgress[videoPath] || null;
    }

    // 获取指定剧集的播放进度
    getEpisodeProgress(episodePath) {
        return this.getPlaybackProgress(episodePath);
    }

    // 保存最后播放的季和集信息
    saveLastPlayedEpisode() {
        if (this.playerController.currentTvShowPath && this.playerController.currentSeason && this.playerController.currentEpisode) {
            const lastPlayed = {
                tvShowPath: this.playerController.currentTvShowPath,
                season: this.playerController.currentSeason,
                episode: this.playerController.currentEpisode,
                timestamp: Date.now()
            };
            
            // 保存到设置文件
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('save-last-played', lastPlayed);
            console.log(`保存最后播放记录: ${this.playerController.currentTvShowPath} - 第${this.playerController.currentSeason}季第${this.playerController.currentEpisode}集`);
        }
    }

    // 获取最后播放的季和集信息
    getLastPlayedEpisode(tvShowPath) {
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('get-last-played', { tvShowPath: tvShowPath });
    }

    // 恢复播放进度
    restorePlaybackProgress() {
        if (this.currentVideoPath && this.playerController.videoPlayer) {
            const progress = this.getPlaybackProgress(this.currentVideoPath);
            if (progress && progress.currentTime > 0) {
                // 如果进度存在且大于0秒，恢复播放进度
                const resumeTime = progress.currentTime;
                
                // 设置进度恢复提示
                const statusInfo = document.getElementById('tvShowTitle');
                const originalText = statusInfo.textContent;
                statusInfo.textContent = `${originalText} - 恢复播放: ${this.formatTime(resumeTime)}`;
                
                // 设置播放位置
                this.playerController.videoPlayer.currentTime = resumeTime;
                
                console.log(`恢复播放进度: ${this.currentVideoPath} - ${this.formatTime(resumeTime)}`);
                
                // 3秒后恢复原文本
                setTimeout(() => {
                    statusInfo.textContent = originalText;
                }, 3000);
            }
        }
    }

    // 进度自动保存函数
    startProgressAutoSave() {
        // 清除之前的定时器
        if (this.progressSaveTimer) {
            clearInterval(this.progressSaveTimer);
        }
        
        // 每10秒自动保存一次播放进度
        this.progressSaveTimer = setInterval(() => {
            if (this.playerController.videoPlayer && !this.playerController.videoPlayer.paused) {
                this.savePlaybackProgress();
            }
        }, 10000);
    }

    stopProgressAutoSave() {
        if (this.progressSaveTimer) {
            clearInterval(this.progressSaveTimer);
            this.progressSaveTimer = null;
        }
    }

    // 事件处理函数
    onPlaybackProgressLoaded(data) {
        if (data && data.playbackProgress) {
            this.playbackProgress = data.playbackProgress;
            console.log('播放进度数据已加载:', Object.keys(this.playbackProgress).length, '个视频的进度');
        }
    }

    onLastPlayedLoaded(data) {
        if (data && data.lastPlayed) {
            console.log('接收到最后播放信息:', data.lastPlayed);
            const { season, episode } = data.lastPlayed;
            this.lastPlayedSeason = season;
            this.lastPlayedEpisode = episode;
            
            // 如果当前电视剧路径匹配，并且有可用的季和集信息
            if (season && episode) {
                console.log(`尝试恢复上次播放位置: 第${season}季第${episode}集`);
                
                // 如果季列表已经加载，需要重新加载集数
                if (this.playerController.seasons.length > 0) {
                    const hasLastPlayedSeason = this.playerController.seasons.some(s => s.number === season);
                    if (hasLastPlayedSeason) {
                        console.log(`切换到第${season}季`);
                        this.playerController.currentSeason = season;
                        this.playerController.renderSeasonButtons();
                        
                        // 加载该季的集数
                        this.playerController.loadEpisodes(season);
                        
                        // 设置目标集数，等集数加载完成后播放
                        this.targetEpisode = episode;
                    } else {
                        console.log(`第${season}季不存在，使用当前季`);
                    }
                }
            } else {
                console.log('无有效的上次播放信息，播放第一集');
            }
        } else {
            console.log('无上次播放记录，播放第一集');
        }
    }

    // 更新当前视频路径
    setCurrentVideoPath(videoPath) {
        this.currentVideoPath = videoPath;
    }

    // 格式化时间（秒 -> MM:SS）
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    // 清理方法
    cleanup() {
        console.log('清理播放进度管理器资源...');
        this.stopProgressAutoSave();
        
        // 保存当前播放进度
        this.savePlaybackProgress();
        
        // 保存当前播放的季和集信息
        this.saveLastPlayedEpisode();
        
        console.log('播放进度管理器资源清理完成');
    }
}

// 导出类供其他模块使用
module.exports = PlaybackManager;