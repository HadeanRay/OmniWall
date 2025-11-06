class PlayerController {
    constructor() {
        this.videoPlayer = null;
        this.isPlaying = false;
        this.currentSeason = 1;
        this.currentEpisode = 1;
        this.currentTvShowName = '';
        this.currentTvShowPath = '';
        this.seasons = [];
        this.episodes = [];
        this.currentVideoPath = '';
        
        // 倍速设置
        this.playbackRates = [0.25, 0.5, 1, 1.5, 2];
        this.currentPlaybackRate = 1;
        this.speedMenuVisible = false;
        
        // 调试信息
        this.debugInfo = {
            videoLoadCount: 0,
            lastMemoryCheck: 0,
            videoErrors: []
        };
        
        // 模块引用
        this.playbackManager = null;
        this.subtitleManager = null;
        this.uiController = null;
        this.inputHandler = null;
        
        this.initialize();
    }

    initialize() {
        try {
            this.videoPlayer = document.getElementById('videoPlayer');
            
            if (!this.videoPlayer) {
                throw new Error('找不到视频播放器元素');
            }
            
            // 绑定视频事件
            this.bindVideoEvents();
            
            // 绑定 IPC 事件
            this.bindIpcEvents();
            
            console.log('播放器控制器初始化完成');
        } catch (error) {
            console.error('播放器控制器初始化失败:', error);
            this.showError('播放器初始化失败: ' + error.message);
        }
    }

    bindVideoEvents() {
        this.videoPlayer.addEventListener('loadeddata', () => this.onVideoLoaded());
        this.videoPlayer.addEventListener('error', (e) => this.onVideoError(e));
        this.videoPlayer.addEventListener('play', () => this.onVideoPlay());
        this.videoPlayer.addEventListener('pause', () => this.onVideoPause());
        this.videoPlayer.addEventListener('timeupdate', () => this.onTimeUpdate());
        this.videoPlayer.addEventListener('ended', () => this.onVideoEnded());
    }

    bindIpcEvents() {
        const { ipcRenderer } = require('electron');
        
        ipcRenderer.on('play-video', (event, data) => this.onPlayVideo(data));
        ipcRenderer.on('seasons-loaded', (event, data) => this.onSeasonsLoaded(data));
        ipcRenderer.on('season-episodes-loaded', (event, data) => this.onSeasonEpisodesLoaded(data));
        ipcRenderer.on('playback-progress-loaded', (event, data) => this.onPlaybackProgressLoaded(data));
        ipcRenderer.on('last-played-loaded', (event, data) => this.onLastPlayedLoaded(data));
        ipcRenderer.on('subtitle-setting-loaded', (event, data) => this.onSubtitleSettingLoaded(data));
    }

    // 播放控制方法
    playPause() {
        if (this.videoPlayer.paused) {
            this.videoPlayer.play();
        } else {
            this.videoPlayer.pause();
        }
    }

    fastForward() {
        this.videoPlayer.currentTime += 10;
    }

    rewind() {
        this.videoPlayer.currentTime -= 10;
    }

    setVolume(volume) {
        this.videoPlayer.volume = volume;
        this.updateVolumeIcon();
    }

    toggleMute() {
        this.videoPlayer.muted = !this.videoPlayer.muted;
        this.updateVolumeIcon();
    }

    seek(event) {
        if (!this.videoPlayer.duration) return;
        
        const progressBar = event.currentTarget;
        const rect = progressBar.getBoundingClientRect();
        const percent = (event.clientX - rect.left) / rect.width;
        const seekTime = percent * this.videoPlayer.duration;
        
        this.videoPlayer.currentTime = seekTime;
    }

    // 进度条拖动开始
    onProgressDragStart(event) {
        // 阻止默认行为
        event.preventDefault();
        
        // 获取进度条元素
        const progressBar = document.querySelector('.progress-bar');
        const progressHandle = document.querySelector('.progress-handle');
        
        if (!progressBar || !progressHandle || !this.videoPlayer.duration) return;
        
        // 添加拖动状态类
        progressHandle.classList.add('active');
        
        // 绑定鼠标移动和释放事件
        const onMouseMove = (e) => this.onProgressDrag(e, progressBar);
        const onMouseUp = () => this.onProgressDragEnd(onMouseMove, onMouseUp);
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        
        // 立即更新进度
        this.onProgressDrag(event, progressBar);
    }

    // 进度条拖动中
    onProgressDrag(event, progressBar) {
        if (!this.videoPlayer.duration) return;
        
        const rect = progressBar.getBoundingClientRect();
        let percent = (event.clientX - rect.left) / rect.width;
        
        // 限制范围在0-1之间
        percent = Math.max(0, Math.min(1, percent));
        
        const seekTime = percent * this.videoPlayer.duration;
        this.videoPlayer.currentTime = seekTime;
        
        // 更新UI
        this.uiController.updateProgress();
    }

    // 进度条拖动结束
    onProgressDragEnd(onMouseMove, onMouseUp) {
        // 移除事件监听器
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        
        // 移除拖动状态类
        const progressHandle = document.querySelector('.progress-handle');
        if (progressHandle) {
            progressHandle.classList.remove('active');
        }
    }

    toggleFullscreen() {
        const container = document.querySelector('.video-container');
        if (!document.fullscreenElement) {
            if (container.requestFullscreen) {
                container.requestFullscreen();
            } else if (container.webkitRequestFullscreen) {
                container.webkitRequestFullscreen();
            } else if (container.msRequestFullscreen) {
                container.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    }

    // 季集导航
    selectSeason(season) {
        this.currentSeason = season;
        this.currentEpisode = 1;
        this.renderSeasonButtons();
        this.loadEpisodes(season);
        console.log('选择季:', season);
        
        // 清空当前集按钮，等待数据加载
        const episodeGrid = document.getElementById('episodeButtons');
        episodeGrid.innerHTML = '<div style="color: #666; font-size: 14px;">加载中...</div>';
        
        // 切换季时加载字幕设置
        this.loadSubtitleSetting();
    }

    selectEpisode(episode) {
        this.currentEpisode = episode;
        this.renderEpisodeButtons();
        
        // 检查当前集的播放进度
        const currentEpisodeData = this.episodes.find(ep => ep.number === episode);
        if (currentEpisodeData && currentEpisodeData.path) {
            const progress = this.getEpisodeProgress(currentEpisodeData.path);
            // 如果该集已经完全播放完成（当前时间等于总时长），则从头开始播放
            if (progress && progress.currentTime >= progress.duration) {
                console.log('该集已完全播放完成，从头开始播放');
                // 临时设置播放进度为0，这样在playCurrentEpisode中恢复进度时会从头开始
                const originalProgress = this.playbackManager ? this.playbackManager.playbackProgress : null;
                if (this.playbackManager && this.playbackManager.playbackProgress) {
                    // 临时移除该集的播放进度
                    delete this.playbackManager.playbackProgress[currentEpisodeData.path];
                }
                this.playCurrentEpisode();
                // 恢复原来的播放进度
                if (this.playbackManager && this.playbackManager.playbackProgress && originalProgress) {
                    this.playbackManager.playbackProgress = originalProgress;
                }
            } else {
                this.playCurrentEpisode();
            }
        } else {
            this.playCurrentEpisode();
        }
        
        console.log('选择集:', episode);
    }

    prevEpisode() {
        if (this.currentEpisode > 1) {
            this.selectEpisode(this.currentEpisode - 1);
        }
    }

    nextEpisode() {
        if (this.currentEpisode < this.episodes.length) {
            this.selectEpisode(this.currentEpisode + 1);
        } else {
            // 如果当前是最后一集，尝试切换到下一季的第一集
            const nextSeason = this.seasons.find(s => s.number === this.currentSeason + 1);
            if (nextSeason) {
                this.selectSeason(this.currentSeason + 1);
            } else {
                console.log('已经是最后一集了');
            }
        }
    }

    playCurrentEpisode() {
        console.log('播放当前集:', this.currentSeason, this.currentEpisode, this.episodes);
        const currentEpisodeData = this.episodes.find(ep => ep.number === this.currentEpisode);
        if (currentEpisodeData && currentEpisodeData.path) {
            this.uiController.showLoading();
            this.uiController.hideError();
            
            // 保存当前视频的播放进度（如果正在播放）
            if (this.currentVideoPath && this.videoPlayer) {
                this.savePlaybackProgress();
            }
            
            // 停止进度自动保存
            this.stopProgressAutoSave();
            
            // 先停止当前播放并清理资源
            if (this.videoPlayer) {
                this.videoPlayer.pause();
                this.videoPlayer.currentTime = 0;
                this.videoPlayer.src = '';
                this.videoPlayer.load();
            }
            
            // 重置字幕菜单状态
            if (this.subtitleManager) {
                this.subtitleManager.subtitleMenuVisible = false;
            }
            const subtitleMenu = document.getElementById('subtitleMenu');
            if (subtitleMenu) {
                subtitleMenu.classList.remove('active');
            }
            // 清除点击外部关闭菜单的事件监听器
            document.removeEventListener('click', this.closeSubtitleMenuOnClick, true);
            
            // 设置新的视频源
            const videoPath = `file://${currentEpisodeData.path}`;
            this.currentVideoPath = currentEpisodeData.path; // 更新当前视频路径
            
            // 更新播放进度管理器的当前视频路径
            if (this.playbackManager) {
                this.playbackManager.setCurrentVideoPath(this.currentVideoPath);
            }
            
            console.log('设置视频源:', videoPath);
            
            // 使用新的视频元素替换，避免内存泄漏
            const oldVideoPlayer = this.videoPlayer;
            const newVideoPlayer = document.createElement('video');
            newVideoPlayer.id = 'videoPlayer';
            newVideoPlayer.style.display = 'none';
            newVideoPlayer.controls = false; // 禁用默认控件
            newVideoPlayer.disablePictureInPicture = true;
            newVideoPlayer.disableRemotePlayback = true;
            
            // 重新绑定事件监听器
            newVideoPlayer.addEventListener('loadeddata', () => this.onVideoLoaded());
            newVideoPlayer.addEventListener('error', (e) => this.onVideoError(e));
            newVideoPlayer.addEventListener('play', () => this.onVideoPlay());
            newVideoPlayer.addEventListener('pause', () => this.onVideoPause());
            newVideoPlayer.addEventListener('timeupdate', () => this.onTimeUpdate());
            newVideoPlayer.addEventListener('ended', () => this.onVideoEnded());
            
            // 替换视频元素
            const videoWrapper = document.querySelector('.video-wrapper');
            if (oldVideoPlayer && oldVideoPlayer.parentNode) {
                videoWrapper.removeChild(oldVideoPlayer);
            }
            videoWrapper.appendChild(newVideoPlayer);
            this.videoPlayer = newVideoPlayer;
            
            this.videoPlayer.src = videoPath;
            
            // 添加加载超时检查
            this.loadTimeout = setTimeout(() => {
                if (this.videoPlayer.networkState === this.videoPlayer.NETWORK_LOADING) {
                    console.warn('视频加载超时');
                    this.uiController.hideLoading();
                    this.uiController.showError('视频加载超时，请检查文件是否损坏');
                    clearTimeout(this.loadTimeout);
                    this.loadTimeout = null;
                }
            }, 15000); // 15秒超时
            
            this.videoPlayer.load();
            
            this.videoPlayer.play().catch(error => {
                if (this.loadTimeout) {
                    clearTimeout(this.loadTimeout);
                    this.loadTimeout = null;
                }
                console.error('播放失败:', error);
                this.debugInfo.videoErrors.push({
                    episode: this.currentEpisode,
                    error: error.message,
                    timestamp: Date.now()
                });
                this.uiController.hideLoading();
                this.uiController.showError('播放失败：' + this.getVideoError(error));
            });
            
            // 更新标题显示当前季集信息
            this.uiController.updateEpisodeTitle();
            
            // 恢复播放进度
            this.restorePlaybackProgress();
            
            // 开始自动保存进度
            this.startProgressAutoSave();
            
            // 重新渲染集按钮以更新播放进度状态
            this.renderEpisodeButtons();
            
            // 播放新集时加载字幕
            this.loadSubtitles();
        } else {
            console.error('未找到集数数据:', this.currentEpisode);
            this.uiController.showError(`未找到第${this.currentSeason}季第${this.currentEpisode}集的视频文件`);
        }
    }

    // 事件处理函数
    onVideoLoaded() {
        if (this.loadTimeout) {
            clearTimeout(this.loadTimeout);
            this.loadTimeout = null;
        }
        this.uiController.hideLoading();
        this.uiController.hideError();
        this.videoPlayer.style.display = 'block';
        this.debugInfo.videoLoadCount++;
        console.log('视频加载完成，总加载次数:', this.debugInfo.videoLoadCount);
        
        // 如果加载次数过多，强制刷新页面避免内存泄漏
        if (this.debugInfo.videoLoadCount > 10) {
            console.warn('视频加载次数过多，可能内存泄漏，建议重新加载页面');
            this.debugInfo.videoLoadCount = 0;
        }
        
        // 开始内存监控
        this.startMemoryMonitoring();
    }

    onVideoError(e) {
        if (this.loadTimeout) {
            clearTimeout(this.loadTimeout);
            this.loadTimeout = null;
        }
        
        // 检查是否是真正的错误，而不是因为替换video元素导致的临时错误
        if (this.videoPlayer && this.videoPlayer.error) {
            this.uiController.hideLoading();
            this.uiController.showError('视频加载失败：' + this.getVideoError(this.videoPlayer.error));
            console.error('视频加载错误:', this.videoPlayer.error);
            
            this.debugInfo.videoErrors.push({
                episode: this.currentEpisode,
                error: this.videoPlayer.error,
                timestamp: Date.now()
            });
        } else {
            // 可能是临时错误，忽略
            console.log('视频加载过程中的临时错误，已忽略');
        }
    }

    onVideoPlay() {
        this.isPlaying = true;
        this.uiController.updatePlayPauseButton();
    }

    onVideoPause() {
        this.isPlaying = false;
        this.uiController.updatePlayPauseButton();
    }

    onTimeUpdate() {
        this.uiController.updateProgress();
    }

    onVideoEnded() {
        console.log('视频播放结束');
        // 保存当前视频的播放进度
        this.savePlaybackProgress();
        // 重新渲染集按钮以更新播放进度状态
        this.renderEpisodeButtons();
        // 自动播放下一集
        this.nextEpisode();
    }

    onPlayVideo(data) {
        console.log('接收到播放数据:', data);
        const { tvShowName, tvShowPath, videoPath } = data;
        
        this.currentTvShowName = tvShowName;
        this.currentTvShowPath = tvShowPath;
        this.currentVideoPath = videoPath; // 设置当前视频路径
        
        // 更新播放进度管理器的当前视频路径
        if (this.playbackManager) {
            this.playbackManager.setCurrentVideoPath(this.currentVideoPath);
        }
        
        document.getElementById('tvShowTitle').textContent = tvShowName;
        
        if (videoPath) {
            console.log('开始播放视频:', videoPath);
            this.videoPlayer.src = `file://${videoPath}`;
            this.videoPlayer.load();
            
            // 重置上次播放记录变量
            this.lastPlayedSeason = null;
            this.lastPlayedEpisode = null;
            this.targetEpisode = null;
            
            // 获取上次播放的季和集信息
            console.log('请求上次播放信息...');
            this.getLastPlayedEpisode(tvShowPath);
            
            // 加载季列表（在获取到上次播放信息后会处理）
            console.log('开始加载季列表...');
            this.loadSeasons();
            
            // 恢复播放进度
            this.restorePlaybackProgress();
            
            // 开始自动保存进度
            this.startProgressAutoSave();
            
            // 加载字幕设置
            this.loadSubtitleSetting();
        } else {
            this.uiController.hideLoading();
            this.uiController.showError('未找到可播放的视频文件');
        }
    }

    onSeasonsLoaded(data) {
        console.log('接收到季列表数据:', data);
        this.seasons = data.seasons || [];
        console.log('解析后的季列表:', this.seasons);
        
        // 检查是否需要切换到上次播放的季
        if (this.lastPlayedSeason !== null) {
            const hasLastPlayedSeason = this.seasons.some(s => s.number === this.lastPlayedSeason);
            if (hasLastPlayedSeason) {
                console.log(`切换到上次播放的第${this.lastPlayedSeason}季`);
                this.currentSeason = this.lastPlayedSeason;
                this.targetEpisode = this.lastPlayedEpisode;
            } else {
                console.log(`上次播放的第${this.lastPlayedSeason}季不存在，使用第一季`);
                this.currentSeason = this.seasons.length > 0 ? this.seasons[0].number : 1;
                this.targetEpisode = null;
            }
        } else if (!this.seasons.some(s => s.number === this.currentSeason) && this.seasons.length > 0) {
            // 如果当前季不在季列表中，自动选择第一个可用的季
            this.currentSeason = this.seasons[0].number;
            console.log('自动切换到第一个可用的季:', this.currentSeason);
        }
        
        this.renderSeasonButtons();
        
        // 加载当前季的集数
        if (this.seasons.length > 0) {
            console.log('开始加载第', this.currentSeason, '季的集数');
            this.loadEpisodes(this.currentSeason);
        } else {
            console.log('未找到季数据，无法加载集数');
        }
    }

    onSeasonEpisodesLoaded(data) {
        this.episodes = data.episodes || [];
        console.log('接收到集数数据:', data);
        console.log('当前季:', this.currentSeason, '集数列表:', this.episodes);
        this.renderEpisodeButtons();
        console.log(`加载了 ${this.episodes.length} 集`);
        
        // 检查是否需要播放上次播放的集
        if (this.targetEpisode !== null) {
            console.log('尝试播放目标集:', this.targetEpisode);
            const episodeExists = this.episodes.some(ep => ep.number === this.targetEpisode);
            if (episodeExists) {
                console.log(`播放上次播放的第${this.targetEpisode}集`);
                this.currentEpisode = this.targetEpisode;
                this.renderEpisodeButtons();
                this.playCurrentEpisode();
                this.targetEpisode = null; // 重置目标集数
            } else {
                console.log(`目标集${this.targetEpisode}不存在，播放第一集`);
                this.playCurrentEpisode();
            }
        } else if (this.episodes.length > 0 && this.currentEpisode === 1) {
            // 如果当前集数数据不为空，自动播放第一集
            this.playCurrentEpisode();
        }
    }

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
                if (this.seasons.length > 0) {
                    const hasLastPlayedSeason = this.seasons.some(s => s.number === season);
                    if (hasLastPlayedSeason) {
                        console.log(`切换到第${season}季`);
                        this.currentSeason = season;
                        this.renderSeasonButtons();
                        
                        // 加载该季的集数
                        this.loadEpisodes(season);
                        
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

    onSubtitleSettingLoaded(data) {
        if (data && data.subtitleSetting !== null) {
            console.log('字幕设置已加载:', data.subtitleSetting);
            // 应用字幕设置
            if (this.subtitleManager) {
                this.subtitleManager.applySubtitleSetting(data.subtitleSetting);
            }
        }
    }

    // 工具方法
    showError(message) {
        this.uiController.showError(message);
    }

    // 渲染季按钮
    renderSeasonButtons() {
        this.uiController.renderSeasonButtons();
    }

    // 渲染集按钮
    renderEpisodeButtons() {
        this.uiController.renderEpisodeButtons();
    }

    // 更新播放/暂停按钮
    updatePlayPauseButton() {
        this.uiController.updatePlayPauseButton();
    }

    // 更新音量图标
    updateVolumeIcon() {
        this.uiController.updateVolumeIcon();
    }

    // 获取指定剧集的播放进度
    getEpisodeProgress(episodePath) {
        if (this.playbackManager) {
            return this.playbackManager.getEpisodeProgress(episodePath);
        }
        return null;
    }

    // 加载季列表
    loadSeasons() {
        this.uiController.loadSeasons();
    }

    // 加载指定季的集数
    loadEpisodes(season) {
        this.uiController.loadEpisodes(season);
    }

    // 加载字幕设置
    loadSubtitleSetting() {
        if (this.subtitleManager) {
            this.subtitleManager.loadSubtitleSetting();
        }
    }

    // 加载字幕
    loadSubtitles() {
        if (this.subtitleManager) {
            this.subtitleManager.loadSubtitles();
        }
    }

    // 保存播放进度
    savePlaybackProgress() {
        if (this.playbackManager) {
            this.playbackManager.savePlaybackProgress();
        }
    }

    // 恢复播放进度
    restorePlaybackProgress() {
        if (this.playbackManager) {
            this.playbackManager.restorePlaybackProgress();
        }
    }

    // 开始自动保存进度
    startProgressAutoSave() {
        if (this.playbackManager) {
            this.playbackManager.startProgressAutoSave();
        }
    }

    // 停止自动保存进度
    stopProgressAutoSave() {
        if (this.playbackManager) {
            this.playbackManager.stopProgressAutoSave();
        }
    }

    // 保存最后播放的季和集信息
    saveLastPlayedEpisode() {
        if (this.playbackManager) {
            this.playbackManager.saveLastPlayedEpisode();
        }
    }

    // 获取最后播放的季和集信息
    getLastPlayedEpisode(tvShowPath) {
        if (this.playbackManager) {
            this.playbackManager.getLastPlayedEpisode(tvShowPath);
        }
    }

    // 倍速控制方法
    openSpeedSettings() {
        this.speedMenuVisible = !this.speedMenuVisible;
        const speedMenu = document.getElementById('speedMenu');
        if (speedMenu) {
            if (this.speedMenuVisible) {
                speedMenu.classList.add('active');
                // 添加点击外部关闭菜单的事件监听器
                this.closeSpeedMenuOnClick = (event) => this.closeSpeedMenuOnOutsideClick(event);
                setTimeout(() => {
                    document.addEventListener('click', this.closeSpeedMenuOnClick, true);
                }, 100);
            } else {
                speedMenu.classList.remove('active');
                // 清除点击外部关闭菜单的事件监听器
                document.removeEventListener('click', this.closeSpeedMenuOnClick, true);
            }
        }
    }

    closeSpeedMenuOnOutsideClick(event) {
        const speedMenu = document.getElementById('speedMenu');
        const speedButton = document.querySelector('.speed-button');
        if (speedMenu && speedButton && 
            !speedMenu.contains(event.target) && 
            !speedButton.contains(event.target)) {
            this.speedMenuVisible = false;
            speedMenu.classList.remove('active');
            document.removeEventListener('click', this.closeSpeedMenuOnClick, true);
        }
    }

    setPlaybackRate(rate) {
        if (this.videoPlayer && this.playbackRates.includes(rate)) {
            this.currentPlaybackRate = rate;
            this.videoPlayer.playbackRate = rate;
            
            // 更新UI显示
            const speedButton = document.querySelector('.speed-button');
            if (speedButton) {
                speedButton.textContent = `${rate}x`;
            }
            
            // 更新选中状态的UI
            this.playbackRates.forEach(playbackRate => {
                const speedOption = document.querySelector(`[onclick*="setPlaybackRate(${playbackRate})"]`);
                const speedCheck = document.getElementById(`speedCheck${playbackRate}`);
                if (speedOption && speedCheck) {
                    if (playbackRate === rate) {
                        speedOption.classList.add('active');
                        speedCheck.style.opacity = '1';
                    } else {
                        speedOption.classList.remove('active');
                        speedCheck.style.opacity = '0';
                    }
                }
            });
            
            // 关闭菜单
            this.speedMenuVisible = false;
            const speedMenu = document.getElementById('speedMenu');
            if (speedMenu) {
                speedMenu.classList.remove('active');
            }
            
            // 清除点击外部关闭菜单的事件监听器
            document.removeEventListener('click', this.closeSpeedMenuOnClick, true);
            
            console.log(`播放速度设置为: ${rate}x`);
        }
    }

    // 快捷键处理：Ctrl+数字键切换倍速
    handleSpeedShortcut(key) {
        const speedMap = {
            '1': 0.25,
            '2': 0.5,
            '3': 1,
            '4': 1.5,
            '5': 2
        };
        
        if (speedMap[key]) {
            this.setPlaybackRate(speedMap[key]);
            return true;
        }
        return false;
    }

    // 内存监控函数
    startMemoryMonitoring() {
        if (this.uiController) {
            this.uiController.startMemoryMonitoring();
        }
    }

    // 获取视频错误信息
    getVideoError(error) {
        if (!error) return '未知错误';
        
        // 检查是否是DOMException
        if (error instanceof DOMException) {
            switch (error.name) {
                case 'NotAllowedError':
                    return '用户拒绝了播放请求';
                case 'NotSupportedError':
                    return '视频格式不支持或文件损坏';
                case 'InvalidStateError':
                    return '视频状态无效';
                case 'NetworkError':
                    return '网络错误';
                default:
                    return `播放错误: ${error.message || error.name}`;
            }
        }
        
        // 检查是否是标准媒体错误
        if (error.code !== undefined) {
            switch (error.code) {
                case error.MEDIA_ERR_ABORTED:
                    return '视频加载被中止';
                case error.MEDIA_ERR_NETWORK:
                    return '网络错误';
                case error.MEDIA_ERR_DECODE:
                    return '视频解码错误 - 文件可能已损坏';
                case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                    return '视频格式不支持';
                default:
                    return `播放错误 (代码: ${error.code})`;
            }
        }
        
        // 处理其他错误类型
        return error.message || '未知播放错误';
    }

    // 清理方法
    cleanup() {
        console.log('清理播放器控制器资源...');
        
        // 停止进度自动保存
        this.stopProgressAutoSave();
        
        // 保存当前播放进度
        this.savePlaybackProgress();
        
        // 保存当前播放的季和集信息
        this.saveLastPlayedEpisode();
        
        // 清除定时器
        if (this.loadTimeout) {
            clearTimeout(this.loadTimeout);
            this.loadTimeout = null;
        }
        
        // 移除视频事件监听器
        if (this.videoPlayer) {
            this.videoPlayer.removeEventListener('loadeddata', this.onVideoLoaded);
            this.videoPlayer.removeEventListener('error', this.onVideoError);
            this.videoPlayer.removeEventListener('play', this.onVideoPlay);
            this.videoPlayer.removeEventListener('pause', this.onVideoPause);
            this.videoPlayer.removeEventListener('timeupdate', this.onTimeUpdate);
            this.videoPlayer.removeEventListener('ended', this.onVideoEnded);
            
            // 停止视频播放并清理资源
            this.videoPlayer.pause();
            this.videoPlayer.currentTime = 0;
            this.videoPlayer.src = '';
            this.videoPlayer.load();
            
            // 从DOM中移除视频元素
            if (this.videoPlayer.parentNode) {
                this.videoPlayer.parentNode.removeChild(this.videoPlayer);
            }
        }
        
        console.log('播放器控制器资源清理完成');
    }
}

// 导出类供其他模块使用
module.exports = PlayerController;