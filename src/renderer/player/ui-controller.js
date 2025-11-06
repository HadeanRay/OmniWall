class UIController {
    constructor(playerController) {
        this.playerController = playerController;
        this.initialize();
    }

    initialize() {
        console.log('界面控制器初始化完成');
    }

    // 渲染季按钮
    renderSeasonButtons() {
        const seasonGrid = document.getElementById('seasonButtons');
        seasonGrid.innerHTML = '';
        
        if (this.playerController.seasons.length === 0) {
            seasonGrid.innerHTML = '<div style="color: #666; font-size: 14px;">暂无季数据</div>';
            return;
        }
        
        this.playerController.seasons.forEach(season => {
            const button = document.createElement('button');
            button.className = 'season-button';
            if (season.number === this.playerController.currentSeason) {
                button.classList.add('active');
            }
            button.textContent = season.number;
            button.title = season.name;
            button.onclick = () => this.playerController.selectSeason(season.number);
            seasonGrid.appendChild(button);
        });
        
        console.log(`渲染了 ${this.playerController.seasons.length} 个季按钮`);
    }

    // 渲染集按钮
    renderEpisodeButtons() {
        const episodeGrid = document.getElementById('episodeButtons');
        episodeGrid.innerHTML = '';
        
        if (this.playerController.episodes.length === 0) {
            episodeGrid.innerHTML = '<div style="color: #666; font-size: 14px;">暂无集数据</div>';
            return;
        }
        
        this.playerController.episodes.forEach(episode => {
            const button = document.createElement('button');
            button.className = 'episode-button';
            if (episode.number === this.playerController.currentEpisode) {
                button.classList.add('active');
            }
            
            // 检查播放进度，如果超过八分之七则添加已播放样式
            const progress = this.getEpisodeProgress(episode.path);
            if (progress && progress.progress > 0.875) {
                button.classList.add('watched');
            }
            
            // 修改按钮文本格式为"第几集+对应nfo文件<title>"
            // 如果episode.name是来自nfo文件的title，则直接使用
            // 否则使用原来的格式
            const episodeTitle = episode.name ? `${episode.name}` : `第${episode.number}集`;
            button.textContent = `第${episode.number}集 ${episodeTitle}`;
            button.title = `第${episode.number}集 ${episodeTitle}`;
            
            button.onclick = () => this.playerController.selectEpisode(episode.number);
            episodeGrid.appendChild(button);
        });
        
        console.log(`渲染了 ${this.playerController.episodes.length} 个集按钮`);
    }

    // 获取指定剧集的播放进度
    getEpisodeProgress(episodePath) {
        if (window.playerManager && window.playerManager.playbackManager) {
            return window.playerManager.playbackManager.getEpisodeProgress(episodePath);
        }
        return null;
    }

    // 更新播放/暂停按钮
    updatePlayPauseButton() {
        const btn = document.getElementById('playPauseBtn');
        const playIcon = btn.querySelector('.control-icon');
        if (this.playerController.isPlaying) {
            playIcon.classList.remove('play-icon');
            playIcon.classList.add('pause-icon');
        } else {
            playIcon.classList.remove('pause-icon');
            playIcon.classList.add('play-icon');
        }
    }

    // 初始化播放按钮图标
    initPlayButton() {
        const btn = document.getElementById('playPauseBtn');
        const playIcon = btn.querySelector('.control-icon');
        playIcon.classList.remove('pause-icon');
        playIcon.classList.add('play-icon');
    }

    // 初始化音量按钮图标
    initVolumeButton() {
        const volumeBtn = document.getElementById('volumeBtn');
        const volumeIcon = volumeBtn.querySelector('.control-icon');
        volumeIcon.classList.remove('mute-icon');
        volumeIcon.classList.add('volume-icon');
    }

    // 更新音量图标
    updateVolumeIcon() {
        const volumeBtn = document.getElementById('volumeBtn');
        const volumeSlider = document.getElementById('volumeSlider');
        const volumeIcon = volumeBtn.querySelector('.control-icon');
        
        if (this.playerController.videoPlayer.muted || this.playerController.videoPlayer.volume === 0) {
            volumeIcon.classList.remove('volume-icon');
            volumeIcon.classList.add('mute-icon');
        } else {
            volumeIcon.classList.remove('mute-icon');
            volumeIcon.classList.add('volume-icon');
            // 音量图标统一使用一种，不根据音量大小变化
            volumeSlider.value = this.playerController.videoPlayer.volume;
        }
    }

    // 显示错误信息
    showError(message) {
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').textContent = message;
    }

    // 隐藏错误信息
    hideError() {
        document.getElementById('error').style.display = 'none';
    }

    // 显示加载状态
    showLoading() {
        document.getElementById('loading').style.display = 'block';
    }

    // 隐藏加载状态
    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }

    // 更新进度条
    updateProgress() {
        if (this.playerController.videoPlayer.duration) {
            const progress = (this.playerController.videoPlayer.currentTime / this.playerController.videoPlayer.duration) * 100;
            document.getElementById('progressFill').style.width = progress + '%';
            
            // 更新时间显示
            document.getElementById('currentTime').textContent = this.formatTime(this.playerController.videoPlayer.currentTime);
            document.getElementById('duration').textContent = this.formatTime(this.playerController.videoPlayer.duration);
        }
    }

    // 格式化时间（秒 -> MM:SS）
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    // 加载季列表
    loadSeasons() {
        if (this.playerController.currentTvShowPath) {
            console.log('发送获取季列表请求:', this.playerController.currentTvShowPath);
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('get-seasons', {
                tvShowPath: this.playerController.currentTvShowPath
            });
        } else {
            console.error('当前电视剧路径为空，无法加载季列表');
        }
    }

    // 加载指定季的集数
    loadEpisodes(season) {
        if (this.playerController.currentTvShowPath) {
            console.log('发送获取集数请求:', this.playerController.currentTvShowPath, '季:', season);
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('get-season-episodes', {
                tvShowName: this.playerController.currentTvShowName,
                tvShowPath: this.playerController.currentTvShowPath,
                season: season
            });
        } else {
            console.error('当前电视剧路径为空，无法加载集数');
        }
    }

    // 内存监控函数
    startMemoryMonitoring() {
        if (this.playerController.memoryMonitorInterval) {
            clearInterval(this.playerController.memoryMonitorInterval);
        }
        
        this.playerController.memoryMonitorInterval = setInterval(() => {
            const now = Date.now();
            if (now - this.playerController.debugInfo.lastMemoryCheck > 30000) { // 每30秒检查一次
                this.playerController.debugInfo.lastMemoryCheck = now;
                console.log('内存使用情况:', {
                    videoLoadCount: this.playerController.debugInfo.videoLoadCount,
                    videoErrors: this.playerController.debugInfo.videoErrors.length,
                    timestamp: new Date().toISOString()
                });
                
                // 强制垃圾回收（如果可用）
                if (window.gc) {
                    window.gc();
                    console.log('执行垃圾回收');
                }
            }
        }, 5000);
    }

    // 更新剧集标题显示
    updateEpisodeTitle() {
        const titleElement = document.getElementById('tvShowTitle');
        if (!titleElement) return;
        
        if (this.playerController.currentEpisodeData) {
            const episode = this.playerController.currentEpisodeData;
            const season = this.playerController.currentSeason;
            const tvShowName = this.playerController.currentTvShowName;
            
            let titleText = `${tvShowName} - 第${season}季 第${episode.number}集`;
            // 如果episode.name是来自nfo文件的title，则直接使用
            if (episode.name) {
                titleText += ` - ${episode.name}`;
            }
            
            titleElement.textContent = titleText;
        } else {
            titleElement.textContent = this.playerController.currentTvShowName || '正在加载...';
        }
    }

    // 清理方法
    cleanup() {
        console.log('清理界面控制器资源...');
        
        if (this.playerController.memoryMonitorInterval) {
            clearInterval(this.playerController.memoryMonitorInterval);
            this.playerController.memoryMonitorInterval = null;
        }
        
        console.log('界面控制器资源清理完成');
    }
}

// 导出类供其他模块使用
module.exports = UIController;