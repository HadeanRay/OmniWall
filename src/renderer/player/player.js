const { ipcRenderer } = require('electron');

let videoPlayer = null;
let isPlaying = false;
let currentSeason = 1;
let currentEpisode = 1;
let currentTvShowName = '';
let currentTvShowPath = '';
let seasons = [];
let episodes = [];
let controlsTimeout = null;
let loadTimeout = null;
let memoryMonitorInterval = null;

// 字幕相关变量
let subtitles = [];
let currentSubtitle = null;
let subtitleMenuVisible = false;
let subtitleSettings = {}; // 字幕设置存储

// 事件监听器引用
let videoEventListeners = [];
let ipcEventListeners = [];

// 播放进度管理
let playbackProgress = {}; // 存储所有播放进度
let currentVideoPath = ''; // 当前播放的视频路径
let progressSaveTimer = null; // 进度保存定时器

// 最后播放记录
let lastPlayedSeason = null;
let lastPlayedEpisode = null;
let targetEpisode = null; // 目标集数（用于恢复播放）

// 调试信息
let debugInfo = {
    videoLoadCount: 0,
    lastMemoryCheck: 0,
    videoErrors: []
};

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

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    try {
        videoPlayer = document.getElementById('videoPlayer');
        
        if (!videoPlayer) {
            throw new Error('找不到视频播放器元素');
        }
        
        // 初始化按钮图标
        initPlayButton();
        initVolumeButton();
        
        // 加载播放进度设置
        loadPlaybackProgress();
        
        // 监听播放器事件
        videoPlayer.addEventListener('loadeddata', onVideoLoaded);
        videoPlayer.addEventListener('error', onVideoError);
        videoPlayer.addEventListener('play', onVideoPlay);
        videoPlayer.addEventListener('pause', onVideoPause);
        videoPlayer.addEventListener('timeupdate', updateProgress);
        videoPlayer.addEventListener('ended', onVideoEnded);
        
        // 接收播放数据
        ipcRenderer.on('play-video', onPlayVideo);
        
        // 监听季列表加载完成
        ipcRenderer.on('seasons-loaded', onSeasonsLoaded);
        
        // 监听集数加载完成
        ipcRenderer.on('season-episodes-loaded', onSeasonEpisodesLoaded);
        
        // 接收播放进度加载完成
        ipcRenderer.on('playback-progress-loaded', (event, data) => {
            if (data && data.playbackProgress) {
                playbackProgress = data.playbackProgress;
                console.log('播放进度数据已加载:', Object.keys(playbackProgress).length, '个视频的进度');
            }
        });

        // 接收字幕设置加载完成
        ipcRenderer.on('subtitle-setting-loaded', (event, data) => {
            if (data && data.subtitleSetting !== null) {
                console.log('字幕设置已加载:', data.subtitleSetting);
                // 应用字幕设置
                applySubtitleSetting(data.subtitleSetting);
            }
        });
        
        // 监听最后播放信息返回
        ipcRenderer.on('last-played-loaded', (event, data) => {
            if (data && data.lastPlayed) {
                console.log('接收到最后播放信息:', data.lastPlayed);
                const { season, episode } = data.lastPlayed;
                lastPlayedSeason = season;
                lastPlayedEpisode = episode;
                
                // 如果当前电视剧路径匹配，并且有可用的季和集信息
                if (season && episode) {
                    console.log(`尝试恢复上次播放位置: 第${season}季第${episode}集`);
                    
                    // 如果季列表已经加载，需要重新加载集数
                    if (seasons.length > 0) {
                        const hasLastPlayedSeason = seasons.some(s => s.number === season);
                        if (hasLastPlayedSeason) {
                            console.log(`切换到第${season}季`);
                            currentSeason = season;
                            renderSeasonButtons();
                            
                            // 加载该季的集数
                            loadEpisodes(season);
                            
                            // 设置目标集数，等集数加载完成后播放
                            targetEpisode = episode;
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
        });
        
        // 页面卸载时清理资源
        window.addEventListener('beforeunload', cleanup);
        
        console.log('播放器初始化完成');
    } catch (error) {
        console.error('播放器初始化失败:', error);
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').textContent = '播放器初始化失败: ' + error.message;
    }
});

// 加载季列表
function loadSeasons() {
    if (currentTvShowPath) {
        console.log('发送获取季列表请求:', currentTvShowPath);
        ipcRenderer.send('get-seasons', {
            tvShowPath: currentTvShowPath
        });
    } else {
        console.error('当前电视剧路径为空，无法加载季列表');
    }
}

// 加载指定季的集数
function loadEpisodes(season) {
    if (currentTvShowPath) {
        console.log('发送获取集数请求:', currentTvShowPath, '季:', season);
        ipcRenderer.send('get-season-episodes', {
            tvShowName: currentTvShowName,
            tvShowPath: currentTvShowPath,
            season: season
        });
    } else {
        console.error('当前电视剧路径为空，无法加载集数');
    }
}

// 渲染季按钮
function renderSeasonButtons() {
    const seasonGrid = document.getElementById('seasonButtons');
    seasonGrid.innerHTML = '';
    
    if (seasons.length === 0) {
        seasonGrid.innerHTML = '<div style="color: #666; font-size: 14px;">暂无季数据</div>';
        return;
    }
    
    seasons.forEach(season => {
        const button = document.createElement('button');
        button.className = 'season-button';
        if (season.number === currentSeason) {
            button.classList.add('active');
        }
        button.textContent = season.number;
        button.title = season.name;
        button.onclick = () => selectSeason(season.number);
        seasonGrid.appendChild(button);
    });
    
    console.log(`渲染了 ${seasons.length} 个季按钮`);
}

// 渲染集按钮
function renderEpisodeButtons() {
    const episodeGrid = document.getElementById('episodeButtons');
    episodeGrid.innerHTML = '';
    
    if (episodes.length === 0) {
        episodeGrid.innerHTML = '<div style="color: #666; font-size: 14px;">暂无集数据</div>';
        return;
    }
    
    episodes.forEach(episode => {
        const button = document.createElement('button');
        button.className = 'episode-button';
        if (episode.number === currentEpisode) {
            button.classList.add('active');
        }
        
        // 检查播放进度，如果超过八分之七则添加已播放样式
        const progress = getEpisodeProgress(episode.path);
        if (progress && progress.progress > 0.875) {
            button.classList.add('watched');
        }
        
        // 修改按钮文本格式为"第几集 集标题"
        const episodeTitle = episode.name ? `第${episode.number}集 ${episode.name}` : `第${episode.number}集`;
        button.textContent = episodeTitle;
        button.title = episodeTitle;
        
        button.onclick = () => selectEpisode(episode.number);
        episodeGrid.appendChild(button);
    });
    
    console.log(`渲染了 ${episodes.length} 个集按钮`);
}

// 播放/暂停控制
function playPause() {
    if (videoPlayer.paused) {
        videoPlayer.play();
    } else {
        videoPlayer.pause();
    }
}

// 更新播放/暂停按钮
function updatePlayPauseButton() {
    const btn = document.getElementById('playPauseBtn');
    const playIcon = btn.querySelector('.play-icon');
    if (isPlaying) {
        playIcon.textContent = '❚❚';
    } else {
        playIcon.textContent = '▶';
    }
}

// 初始化播放按钮图标
function initPlayButton() {
    const btn = document.getElementById('playPauseBtn');
    const playIcon = btn.querySelector('.play-icon');
    playIcon.textContent = '▶';
}

// 初始化音量按钮图标
function initVolumeButton() {
    const volumeBtn = document.getElementById('volumeBtn');
    const volumeIcon = volumeBtn.querySelector('.volume-icon');
    volumeIcon.textContent = '🔊';
}

// 事件处理函数
function onVideoLoaded() {
    if (loadTimeout) {
        clearTimeout(loadTimeout);
        loadTimeout = null;
    }
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'none'; // 清除错误显示
    videoPlayer.style.display = 'block';
    debugInfo.videoLoadCount++;
    console.log('视频加载完成，总加载次数:', debugInfo.videoLoadCount);
    
    // 如果加载次数过多，强制刷新页面避免内存泄漏
    if (debugInfo.videoLoadCount > 10) {
        console.warn('视频加载次数过多，可能内存泄漏，建议重新加载页面');
        debugInfo.videoLoadCount = 0;
    }
    
    // 开始内存监控
    startMemoryMonitoring();
}

function onVideoError(e) {
    if (loadTimeout) {
        clearTimeout(loadTimeout);
        loadTimeout = null;
    }
    
    // 检查是否是真正的错误，而不是因为替换video元素导致的临时错误
    if (videoPlayer && videoPlayer.error) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').textContent = '视频加载失败：' + getVideoError(videoPlayer.error);
        console.error('视频加载错误:', videoPlayer.error);
        
        debugInfo.videoErrors.push({
            episode: currentEpisode,
            error: videoPlayer.error,
            timestamp: Date.now()
        });
    } else {
        // 可能是临时错误，忽略
        console.log('视频加载过程中的临时错误，已忽略');
    }
}

function onVideoPlay() {
    isPlaying = true;
    updatePlayPauseButton();
}

function onVideoPause() {
    isPlaying = false;
    updatePlayPauseButton();
}

function onVideoEnded() {
    console.log('视频播放结束');
    // 保存当前视频的播放进度
    savePlaybackProgress();
    // 重新渲染集按钮以更新播放进度状态
    renderEpisodeButtons();
    // 自动播放下一集
    nextEpisode();
}

function onPlayVideo(event, data) {
    console.log('接收到播放数据:', data);
    const { tvShowName, tvShowPath, videoPath } = data;
    
    currentTvShowName = tvShowName;
    currentTvShowPath = tvShowPath;
    currentVideoPath = videoPath; // 设置当前视频路径
    
    document.getElementById('tvShowTitle').textContent = tvShowName;
    
    if (videoPath) {
        console.log('开始播放视频:', videoPath);
        videoPlayer.src = `file://${videoPath}`;
        videoPlayer.load();
        
        // 重置上次播放记录变量
        lastPlayedSeason = null;
        lastPlayedEpisode = null;
        targetEpisode = null;
        
        // 获取上次播放的季和集信息
        console.log('请求上次播放信息...');
        getLastPlayedEpisode(tvShowPath);
        
        // 加载季列表（在获取到上次播放信息后会处理）
        console.log('开始加载季列表...');
        loadSeasons();
        
        // 恢复播放进度
        restorePlaybackProgress();
        
        // 开始自动保存进度
        startProgressAutoSave();
        
        // 加载字幕设置
        loadSubtitleSetting();
    } else {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').textContent = '未找到可播放的视频文件';
    }
}

function onSeasonsLoaded(event, data) {
    console.log('接收到季列表数据:', data);
    seasons = data.seasons || [];
    console.log('解析后的季列表:', seasons);
    
    // 检查是否需要切换到上次播放的季
    if (lastPlayedSeason !== null) {
        const hasLastPlayedSeason = seasons.some(s => s.number === lastPlayedSeason);
        if (hasLastPlayedSeason) {
            console.log(`切换到上次播放的第${lastPlayedSeason}季`);
            currentSeason = lastPlayedSeason;
            targetEpisode = lastPlayedEpisode;
        } else {
            console.log(`上次播放的第${lastPlayedSeason}季不存在，使用第一季`);
            currentSeason = seasons.length > 0 ? seasons[0].number : 1;
            targetEpisode = null;
        }
    } else if (!seasons.some(s => s.number === currentSeason) && seasons.length > 0) {
        // 如果当前季不在季列表中，自动选择第一个可用的季
        currentSeason = seasons[0].number;
        console.log('自动切换到第一个可用的季:', currentSeason);
    }
    
    renderSeasonButtons();
    
    // 加载当前季的集数
    if (seasons.length > 0) {
        console.log('开始加载第', currentSeason, '季的集数');
        loadEpisodes(currentSeason);
    } else {
        console.log('未找到季数据，无法加载集数');
    }
}

function onSeasonEpisodesLoaded(event, data) {
    episodes = data.episodes || [];
    console.log('接收到集数数据:', data);
    console.log('当前季:', currentSeason, '集数列表:', episodes);
    renderEpisodeButtons();
    console.log(`加载了 ${episodes.length} 集`);
    
    // 检查是否需要播放上次播放的集
    if (targetEpisode !== null) {
        console.log('尝试播放目标集:', targetEpisode);
        const episodeExists = episodes.some(ep => ep.number === targetEpisode);
        if (episodeExists) {
            console.log(`播放上次播放的第${targetEpisode}集`);
            currentEpisode = targetEpisode;
            renderEpisodeButtons();
            playCurrentEpisode();
            targetEpisode = null; // 重置目标集数
        } else {
            console.log(`目标集${targetEpisode}不存在，播放第一集`);
            playCurrentEpisode();
        }
    } else if (episodes.length > 0 && currentEpisode === 1) {
        // 如果当前集数数据不为空，自动播放第一集
        playCurrentEpisode();
    }
}

// 播放进度管理函数
function loadPlaybackProgress() {
    ipcRenderer.send('load-playback-progress');
}

function savePlaybackProgress() {
    if (currentVideoPath && videoPlayer && videoPlayer.duration > 0) {
        const currentTime = videoPlayer.currentTime;
        const duration = videoPlayer.duration;
        const progress = {
            currentTime: currentTime,
            duration: duration,
            progress: currentTime / duration,
            timestamp: Date.now()
        };
        
        playbackProgress[currentVideoPath] = progress;
        
        // 保存到设置文件
        ipcRenderer.send('save-playback-progress', {
            videoPath: currentVideoPath,
            progress: progress
        });
        
        console.log(`保存播放进度: ${currentVideoPath} - ${formatTime(currentTime)} / ${formatTime(duration)}`);
        
        // 重新渲染集按钮以更新播放进度状态
        renderEpisodeButtons();
    }
}

function getPlaybackProgress(videoPath) {
    return playbackProgress[videoPath] || null;
}

// 获取指定剧集的播放进度
function getEpisodeProgress(episodePath) {
    return getPlaybackProgress(episodePath);
}

// 保存最后播放的季和集信息
function saveLastPlayedEpisode() {
    if (currentTvShowPath && currentSeason && currentEpisode) {
        const lastPlayed = {
            tvShowPath: currentTvShowPath,
            season: currentSeason,
            episode: currentEpisode,
            timestamp: Date.now()
        };
        
        // 保存到设置文件
        ipcRenderer.send('save-last-played', lastPlayed);
        console.log(`保存最后播放记录: ${currentTvShowPath} - 第${currentSeason}季第${currentEpisode}集`);
    }
}

// 获取最后播放的季和集信息
function getLastPlayedEpisode(tvShowPath) {
    // 向主进程请求最后播放信息
    ipcRenderer.send('get-last-played', { tvShowPath: tvShowPath });
}

function restorePlaybackProgress() {
    if (currentVideoPath && videoPlayer) {
        const progress = getPlaybackProgress(currentVideoPath);
        if (progress && progress.currentTime > 0) {
            // 如果进度存在且大于0秒，恢复播放进度
            const resumeTime = progress.currentTime;
            
            // 设置进度恢复提示
            const statusInfo = document.getElementById('tvShowTitle');
            const originalText = statusInfo.textContent;
            statusInfo.textContent = `${originalText} - 恢复播放: ${formatTime(resumeTime)}`;
            
            // 设置播放位置
            videoPlayer.currentTime = resumeTime;
            
            console.log(`恢复播放进度: ${currentVideoPath} - ${formatTime(resumeTime)}`);
            
            // 3秒后恢复原文本
            setTimeout(() => {
                statusInfo.textContent = originalText;
            }, 3000);
        }
    }
}

// 进度自动保存函数
function startProgressAutoSave() {
    // 清除之前的定时器
    if (progressSaveTimer) {
        clearInterval(progressSaveTimer);
    }
    
    // 每10秒自动保存一次播放进度
    progressSaveTimer = setInterval(() => {
        if (videoPlayer && !videoPlayer.paused) {
            savePlaybackProgress();
        }
    }, 10000);
}

function stopProgressAutoSave() {
    if (progressSaveTimer) {
        clearInterval(progressSaveTimer);
        progressSaveTimer = null;
    }
}

// 清理函数
function cleanup() {
    console.log('清理播放器资源...');
    
    // 停止进度自动保存
    stopProgressAutoSave();
    
    // 保存当前播放进度
    savePlaybackProgress();
    
    // 保存当前播放的季和集信息
    saveLastPlayedEpisode();
    
    // 清除定时器
    if (controlsTimeout) {
        clearTimeout(controlsTimeout);
        controlsTimeout = null;
    }
    
    if (loadTimeout) {
        clearTimeout(loadTimeout);
        loadTimeout = null;
    }
    
    if (memoryMonitorInterval) {
        clearInterval(memoryMonitorInterval);
        memoryMonitorInterval = null;
    }
    
    // 移除视频事件监听器
    if (videoPlayer) {
        videoPlayer.removeEventListener('loadeddata', onVideoLoaded);
        videoPlayer.removeEventListener('error', onVideoError);
        videoPlayer.removeEventListener('play', onVideoPlay);
        videoPlayer.removeEventListener('pause', onVideoPause);
        videoPlayer.removeEventListener('timeupdate', updateProgress);
        videoPlayer.removeEventListener('ended', onVideoEnded);
        
        // 停止视频播放并清理资源
        videoPlayer.pause();
        videoPlayer.currentTime = 0;
        videoPlayer.src = '';
        videoPlayer.load();
        
        // 从DOM中移除视频元素
        if (videoPlayer.parentNode) {
            videoPlayer.parentNode.removeChild(videoPlayer);
        }
    }
    
    // 移除IPC事件监听器
    if (ipcRenderer) {
        ipcRenderer.removeAllListeners('play-video');
        ipcRenderer.removeAllListeners('seasons-loaded');
        ipcRenderer.removeAllListeners('season-episodes-loaded');
        ipcRenderer.removeAllListeners('playback-progress-loaded');
    }
    
    // 移除键盘事件监听器
    document.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('mousemove', handleMouseMove);
    
    console.log('资源清理完成');
}

// 自动隐藏控制条
function hideControls() {
    const controls = document.querySelector('.floating-controls');
    const tvShowTitle = document.getElementById('tvShowTitle');
    if (controls) {
        controls.style.opacity = '0';
    }
    if (tvShowTitle) {
        tvShowTitle.style.opacity = '0';
    }
}

function showControls() {
    const controls = document.querySelector('.floating-controls');
    const tvShowTitle = document.getElementById('tvShowTitle');
    if (controls) {
        controls.style.opacity = '1';
    }
    if (tvShowTitle) {
        tvShowTitle.style.opacity = '1';
    }
    
    // 清除之前的计时器
    clearTimeout(controlsTimeout);
    
    // 3秒后自动隐藏控制条和标题
    controlsTimeout = setTimeout(() => {
        hideControls();
    }, 3000);
}

// 鼠标移动事件处理函数
function handleMouseMove() {
    showControls();
}

// 键盘事件处理函数
function handleKeydown(e) {
    switch (e.key) {
        case ' ':
        case 'Space':
            e.preventDefault();
            playPause();
            break;
        case 'ArrowLeft':
            e.preventDefault();
            if (e.ctrlKey) {
                prevEpisode();
            } else {
                rewind();
            }
            break;
        case 'ArrowRight':
            e.preventDefault();
            if (e.ctrlKey) {
                nextEpisode();
            } else {
                fastForward();
            }
            break;
        case 'Escape':
            if (document.fullscreenElement) {
                toggleFullscreen();
            }
            break;
        case 'f':
        case 'F':
            if (e.ctrlKey) {
                e.preventDefault();
                toggleFullscreen();
            }
            break;
        case 'm':
        case 'M':
            e.preventDefault();
            toggleMute();
            break;
        case 'ArrowUp':
            e.preventDefault();
            setVolume(Math.min(videoPlayer.volume + 0.1, 1));
            break;
        case 'ArrowDown':
            e.preventDefault();
            setVolume(Math.max(videoPlayer.volume - 0.1, 0));
            break;
        case 's':
        case 'S':
            if (e.ctrlKey) {
                e.preventDefault();
                toggleSubtitleMenu();
            }
            break;
    }
}

// 鼠标移动时显示控制条
document.addEventListener('mousemove', handleMouseMove);

// 选择季
function selectSeason(season) {
    // 在切换季之前保存当前播放进度
    savePlaybackProgress();
    currentSeason = season;
    currentEpisode = 1; // 重置为第一集
    renderSeasonButtons();
    loadEpisodes(season);
    console.log('选择季:', season);
    
    // 清空当前集按钮，等待数据加载
    const episodeGrid = document.getElementById('episodeButtons');
    episodeGrid.innerHTML = '<div style="color: #666; font-size: 14px;">加载中...</div>';
    
    // 切换季时加载字幕设置
    loadSubtitleSetting();
}

// 选择集
function selectEpisode(episode) {
    // 在切换集之前保存当前播放进度
    savePlaybackProgress();
    currentEpisode = episode;
    renderEpisodeButtons();
    playCurrentEpisode();
    console.log('选择集:', episode);
}

// 上一集
function prevEpisode() {
    if (currentEpisode > 1) {
        selectEpisode(currentEpisode - 1);
    }
}

// 下一集
function nextEpisode() {
    if (currentEpisode < episodes.length) {
        selectEpisode(currentEpisode + 1);
    } else {
        // 如果当前是最后一集，尝试切换到下一季的第一集
        const nextSeason = seasons.find(s => s.number === currentSeason + 1);
        if (nextSeason) {
            selectSeason(currentSeason + 1);
        } else {
            console.log('已经是最后一集了');
        }
    }
}

// 内存监控函数
function startMemoryMonitoring() {
    if (memoryMonitorInterval) {
        clearInterval(memoryMonitorInterval);
    }
    
    memoryMonitorInterval = setInterval(() => {
        const now = Date.now();
        if (now - debugInfo.lastMemoryCheck > 30000) { // 每30秒检查一次
            debugInfo.lastMemoryCheck = now;
            console.log('内存使用情况:', {
                videoLoadCount: debugInfo.videoLoadCount,
                videoErrors: debugInfo.videoErrors.length,
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

// 播放当前选中的集
function playCurrentEpisode() {
    console.log('播放当前集:', currentSeason, currentEpisode, episodes);
    const currentEpisodeData = episodes.find(ep => ep.number === currentEpisode);
    if (currentEpisodeData && currentEpisodeData.path) {
        document.getElementById('loading').style.display = 'block';
        document.getElementById('error').style.display = 'none';
        
        // 保存当前视频的播放进度（如果正在播放）
        if (currentVideoPath && videoPlayer) {
            savePlaybackProgress();
        }
        
        // 停止进度自动保存
        stopProgressAutoSave();
        
        // 先停止当前播放并清理资源
        if (videoPlayer) {
            videoPlayer.pause();
            videoPlayer.currentTime = 0;
            videoPlayer.src = '';
            videoPlayer.load();
        }
        
        // 重置字幕菜单状态
        subtitleMenuVisible = false;
        const subtitleMenu = document.getElementById('subtitleMenu');
        if (subtitleMenu) {
            subtitleMenu.classList.remove('active');
        }
        // 清除点击外部关闭菜单的事件监听器
        document.removeEventListener('click', closeSubtitleMenuOnClick, true);
        
        // 设置新的视频源
        const videoPath = `file://${currentEpisodeData.path}`;
        currentVideoPath = currentEpisodeData.path; // 更新当前视频路径
        console.log('设置视频源:', videoPath);
        
        // 使用新的视频元素替换，避免内存泄漏
        const oldVideoPlayer = videoPlayer;
        const newVideoPlayer = document.createElement('video');
        newVideoPlayer.id = 'videoPlayer';
        newVideoPlayer.style.display = 'none';
        newVideoPlayer.controls = false; // 禁用默认控件
        newVideoPlayer.disablePictureInPicture = true;
        newVideoPlayer.disableRemotePlayback = true;
        
        // 重新绑定事件监听器
        newVideoPlayer.addEventListener('loadeddata', onVideoLoaded);
        newVideoPlayer.addEventListener('error', onVideoError);
        newVideoPlayer.addEventListener('play', onVideoPlay);
        newVideoPlayer.addEventListener('pause', onVideoPause);
        newVideoPlayer.addEventListener('timeupdate', updateProgress);
        newVideoPlayer.addEventListener('ended', onVideoEnded);
        
        // 替换视频元素
        const videoWrapper = document.querySelector('.video-wrapper');
        if (oldVideoPlayer && oldVideoPlayer.parentNode) {
            videoWrapper.removeChild(oldVideoPlayer);
        }
        videoWrapper.appendChild(newVideoPlayer);
        videoPlayer = newVideoPlayer;
        
        videoPlayer.src = videoPath;
        
        // 添加加载超时检查
        loadTimeout = setTimeout(() => {
            if (videoPlayer.networkState === videoPlayer.NETWORK_LOADING) {
                console.warn('视频加载超时');
                document.getElementById('loading').style.display = 'none';
                document.getElementById('error').style.display = 'block';
                document.getElementById('error').textContent = '视频加载超时，请检查文件是否损坏';
                clearTimeout(loadTimeout);
                loadTimeout = null;
            }
        }, 15000); // 15秒超时
        
        videoPlayer.load();
        
        videoPlayer.play().catch(error => {
            if (loadTimeout) {
                clearTimeout(loadTimeout);
                loadTimeout = null;
            }
            console.error('播放失败:', error);
            debugInfo.videoErrors.push({
                episode: currentEpisode,
                error: error.message,
                timestamp: Date.now()
            });
            document.getElementById('loading').style.display = 'none';
            document.getElementById('error').style.display = 'block';
            document.getElementById('error').textContent = '播放失败：' + getVideoError(error);
        });
        
        // 更新标题显示当前季集信息
        document.getElementById('tvShowTitle').textContent = 
            `${currentTvShowName} - 第${currentSeason}季 第${currentEpisode}集`;
        
        // 恢复播放进度
        restorePlaybackProgress();
        
        // 开始自动保存进度
        startProgressAutoSave();
        
        // 重新渲染集按钮以更新播放进度状态
        renderEpisodeButtons();
        
        // 播放新集时加载字幕
        loadSubtitles();
    } else {
        console.error('未找到集数数据:', currentEpisode);
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').textContent = `未找到第${currentSeason}季第${currentEpisode}集的视频文件`;
    }
}

// 更新进度条
function updateProgress() {
    if (videoPlayer.duration) {
        const progress = (videoPlayer.currentTime / videoPlayer.duration) * 100;
        document.getElementById('progressFill').style.width = progress + '%';
        
        // 更新时间显示
        document.getElementById('currentTime').textContent = formatTime(videoPlayer.currentTime);
        document.getElementById('duration').textContent = formatTime(videoPlayer.duration);
    }
}

// 格式化时间（秒 -> MM:SS）
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// 跳转到指定位置
function seek(event) {
    if (!videoPlayer.duration) return;
    
    const progressBar = event.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    const seekTime = percent * videoPlayer.duration;
    
    videoPlayer.currentTime = seekTime;
}

// 设置音量
function setVolume(volume) {
    videoPlayer.volume = volume;
    updateVolumeIcon();
}

// 切换静音
function toggleMute() {
    videoPlayer.muted = !videoPlayer.muted;
    updateVolumeIcon();
}

// 更新音量图标
function updateVolumeIcon() {
    const volumeBtn = document.getElementById('volumeBtn');
    const volumeSlider = document.getElementById('volumeSlider');
    
    if (videoPlayer.muted || videoPlayer.volume === 0) {
        volumeBtn.querySelector('.volume-icon').textContent = '🔇';
        volumeSlider.value = 0;
    } else {
        if (videoPlayer.volume < 0.3) {
            volumeBtn.querySelector('.volume-icon').textContent = '🔈';
        } else if (videoPlayer.volume < 0.7) {
            volumeBtn.querySelector('.volume-icon').textContent = '🔉';
        } else {
            volumeBtn.querySelector('.volume-icon').textContent = '🔊';
        }
        volumeSlider.value = videoPlayer.volume;
    }
}

// 初始化时显示控制条
document.addEventListener('DOMContentLoaded', function() {
    // 显示控制条3秒后自动隐藏
    setTimeout(() => {
        hideControls();
    }, 3000);
});

// 快进
function fastForward() {
    videoPlayer.currentTime += 10; // 快进10秒
}

// 快退
function rewind() {
    videoPlayer.currentTime -= 10; // 快退10秒
}

// 视频播放结束处理
function onVideoEnded() {
    console.log('视频播放结束');
    // 自动播放下一集
    nextEpisode();
}

// 上一集
function prevEpisode() {
    if (currentEpisode > 1) {
        selectEpisode(currentEpisode - 1);
    }
}

// 下一集
function nextEpisode() {
    if (currentEpisode < episodes.length) {
        selectEpisode(currentEpisode + 1);
    } else {
        // 如果当前是最后一集，尝试切换到下一季的第一集
        const nextSeason = seasons.find(s => s.number === currentSeason + 1);
        if (nextSeason) {
            selectSeason(currentSeason + 1);
        } else {
            console.log('已经是最后一集了');
        }
    }
}

// 字幕设置功能
function openSubtitleSettings() {
    toggleSubtitleMenu();
}

// 切换字幕菜单显示/隐藏
function toggleSubtitleMenu() {
    const subtitleMenu = document.getElementById('subtitleMenu');
    
    if (subtitleMenuVisible) {
        // 隐藏菜单
        subtitleMenu.classList.remove('active');
        subtitleMenuVisible = false;
        document.removeEventListener('click', closeSubtitleMenuOnClick, true);
    } else {
        // 显示菜单前先加载字幕列表
        loadSubtitles();
        subtitleMenu.classList.add('active');
        subtitleMenuVisible = true;
        
        // 强制重新渲染字幕列表，确保显示最新的字幕选项和当前选择状态
        renderSubtitleList(subtitles);
        
        // 点击其他地方关闭菜单
        setTimeout(() => {
            document.addEventListener('click', closeSubtitleMenuOnClick, true);
        }, 100);
    }
}

// 点击其他地方关闭字幕菜单
function closeSubtitleMenuOnClick(event) {
    const subtitleMenu = document.getElementById('subtitleMenu');
    const subtitleLink = document.querySelector('.setting-link[onclick="openSubtitleSettings()"]');
    
    if (!subtitleMenu.contains(event.target) && event.target !== subtitleLink && !subtitleLink.contains(event.target)) {
        subtitleMenu.classList.remove('active');
        subtitleMenuVisible = false;
        document.removeEventListener('click', closeSubtitleMenuOnClick, true);
    }
}

// 加载字幕列表
function loadSubtitles() {
    if (!videoPlayer || !videoPlayer.src) {
        console.log('没有视频文件，无法加载字幕');
        renderSubtitleList([]);
        return;
    }
    
    // 获取当前视频文件的路径，解码URL编码的路径
    let videoPath = videoPlayer.src.replace('file://', '');
    videoPath = decodeURIComponent(videoPath);
    
    // 修复路径问题：如果路径以 /X:/ 开头，则移除开头的斜杠
    if (videoPath.startsWith('/')) {
        videoPath = videoPath.substring(1);
    }
    
    console.log('加载字幕，视频路径:', videoPath);
    
    // 向主进程请求字幕文件
    ipcRenderer.send('check-external-subtitles', {
        videoPath: videoPath
    });
}

// 保存字幕设置
function saveSubtitleSetting(subtitleIndex) {
    if (!currentTvShowPath || !currentSeason) {
        console.log('无法保存字幕设置: 电视剧路径或季信息缺失');
        return;
    }

    const subtitleSetting = {
        subtitleIndex: subtitleIndex,
        timestamp: Date.now()
    };

    console.log('保存字幕设置:', subtitleSetting);
    
    // 发送到主进程保存
    ipcRenderer.send('save-subtitle-setting', {
        tvShowPath: currentTvShowPath,
        season: currentSeason,
        subtitleSetting: subtitleSetting
    });
}

// 加载字幕设置
function loadSubtitleSetting() {
    if (!currentTvShowPath || !currentSeason) {
        console.log('无法加载字幕设置: 电视剧路径或季信息缺失');
        return;
    }

    console.log('加载字幕设置:', currentTvShowPath, '第', currentSeason, '季');
    
    // 向主进程请求字幕设置
    ipcRenderer.send('get-subtitle-setting', {
        tvShowPath: currentTvShowPath,
        season: currentSeason
    });
}

// 应用字幕设置
function applySubtitleSetting(subtitleSetting) {
    if (!subtitleSetting || subtitleSetting.subtitleIndex === null) {
        console.log('无字幕设置或设置为无字幕');
        return;
    }

    console.log('应用字幕设置:', subtitleSetting, '菜单状态:', subtitleMenuVisible);
    
    // 检查字幕文件是否已加载
    if (subtitles.length > 0) {
        const subtitleIndex = subtitleSetting.subtitleIndex;
        
        // 如果字幕菜单当前是打开的，不要调用selectSubtitle，避免关闭菜单
        if (subtitleMenuVisible) {
            console.log('字幕菜单已打开，跳过自动选择字幕');
            return;
        }
        
        if (subtitleIndex === null) {
            // 关闭字幕
            selectSubtitle(null);
        } else if (subtitleIndex >= 0 && subtitleIndex < subtitles.length) {
            // 选择指定的字幕
            selectSubtitle(subtitleIndex);
        } else {
            console.log('字幕索引无效:', subtitleIndex, '字幕总数:', subtitles.length);
            // 如果设置的字幕索引无效，自动选择第一个字幕
            if (subtitles.length > 0) {
                console.log('自动选择第一个字幕作为备用');
                selectSubtitle(0);
            }
        }
    } else {
        console.log('字幕文件尚未加载，等待字幕加载完成后再应用设置');
        // 使用一次性事件监听器，避免重复绑定
        const applySettingHandler = (event, data) => {
            if (data.status === 'success') {
                console.log('字幕加载完成，重新应用设置');
                // 移除一次性监听器
                ipcRenderer.removeListener('external-subtitles-loaded', applySettingHandler);
                // 重新应用字幕设置
                setTimeout(() => {
                    applySubtitleSetting(subtitleSetting);
                }, 100);
            }
        };
        
        // 添加一次性事件监听器
        ipcRenderer.once('external-subtitles-loaded', applySettingHandler);
    }
}

// 检查并自动选择第一个外部字幕
function autoSelectFirstExternalSubtitle() {
    if (subtitles.length > 0) {
        // 如果有外部字幕，自动选择第一个
        console.log('自动选择第一个外部字幕');
        selectSubtitle(0);
        // 保存设置
        saveSubtitleSetting(0);
    }
}

// 渲染字幕列表
function renderSubtitleList(subtitles) {
    const subtitleList = document.getElementById('subtitleList');
    
    if (!subtitles || subtitles.length === 0) {
        subtitleList.innerHTML = '<div class="no-subtitles">未找到字幕文件</div>';
        return;
    }
    
    let html = '';
    
    // "无字幕"选项
    html += `
        <div class="subtitle-item ${currentSubtitle === null ? 'active' : ''}" onclick="selectSubtitle(null)">
            <div class="subtitle-info">
                <div class="subtitle-type">无字幕</div>
            </div>
            ${currentSubtitle === null ? '<span class="subtitle-status">✓</span>' : ''}
        </div>
    `;
    
    // 字幕文件选项
    subtitles.forEach((subtitle, index) => {
        const isActive = currentSubtitle && currentSubtitle.path === subtitle.path;
        html += `
            <div class="subtitle-item ${isActive ? 'active' : ''}" onclick="selectSubtitle(${index})">
                <div class="subtitle-info">
                    <div class="subtitle-type">${subtitle.type} - ${subtitle.language}</div>
                    <div class="subtitle-file">${subtitle.name}</div>
                </div>
                ${isActive ? '<span class="subtitle-status">✓</span>' : ''}
            </div>
        `;
    });
    
    subtitleList.innerHTML = html;
}

// 选择字幕
function selectSubtitle(index) {
    const subtitleMenu = document.getElementById('subtitleMenu');
    subtitleMenu.classList.remove('active');
    subtitleMenuVisible = false;
    document.removeEventListener('click', closeSubtitleMenuOnClick, true);
    
    if (index === null) {
        // 关闭字幕
        currentSubtitle = null;
        removeSubtitleTrack();
        console.log('关闭字幕');
        // 保存设置
        saveSubtitleSetting(null);
    } else if (subtitles[index]) {
        // 选择字幕文件
        currentSubtitle = subtitles[index];
        loadSubtitleFile(currentSubtitle.path);
        console.log('选择字幕:', currentSubtitle.name);
        // 保存设置
        saveSubtitleSetting(index);
    }
    
    // 更新字幕列表显示
    renderSubtitleList(subtitles);
}

// 加载字幕文件
function loadSubtitleFile(subtitlePath) {
    if (!videoPlayer) return;
    
    // 移除已有的字幕轨道
    removeSubtitleTrack();
    
    // 创建新的字幕轨道
    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.src = `file://${subtitlePath}`;
    track.srclang = 'zh'; // 默认为中文
    track.label = currentSubtitle ? `${currentSubtitle.type} - ${currentSubtitle.language}` : '字幕';
    track.default = true;
    
    videoPlayer.appendChild(track);
    
    // 启用字幕
    videoPlayer.textTracks[0].mode = 'showing';
    
    console.log('字幕文件已加载:', subtitlePath);
}

// 移除字幕轨道
function removeSubtitleTrack() {
    if (!videoPlayer) return;
    
    const tracks = videoPlayer.querySelectorAll('track');
    tracks.forEach(track => {
        videoPlayer.removeChild(track);
    });
    
    console.log('字幕轨道已移除');
}

// 接收外部字幕文件列表
ipcRenderer.on('external-subtitles-loaded', (event, data) => {
    if (data.status === 'success') {
        subtitles = data.subtitles;
        console.log('接收到字幕文件列表:', subtitles);
        
        // 只有在字幕菜单未显示时才重新渲染列表
        // 避免在菜单打开时重新渲染导致菜单关闭
        if (!subtitleMenuVisible) {
            renderSubtitleList(subtitles);
        }
        
        // 如果有外部字幕，检查是否有保存的设置
        // 但只在字幕菜单未显示时加载设置，避免菜单打开时自动选择字幕
        if (subtitles.length > 0 && !subtitleMenuVisible) {
            console.log('有外部字幕可用，加载字幕设置...');
            loadSubtitleSetting();
        } else if (subtitles.length > 0 && subtitleMenuVisible) {
            console.log('字幕菜单已打开，跳过自动加载设置');
        } else {
            console.log('无外部字幕文件');
        }
    } else {
        console.error('获取字幕文件失败:', data.message);
        if (!subtitleMenuVisible) {
            renderSubtitleList([]);
        }
    }
});

// 设置功能（占位）
function openSpeedSettings() {
    alert('倍速设置功能待实现');
}

function openAudioSettings() {
    alert('音频设置功能待实现');
}

// 全屏切换
function toggleFullscreen() {
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

// 窗口控制功能
function minimizeWindow() {
    ipcRenderer.send('window-control', 'minimize');
}

function toggleMaximizeWindow() {
    ipcRenderer.send('window-control', 'toggle-maximize');
}

function closeWindow() {
    ipcRenderer.send('window-control', 'close');
}

// 获取视频错误信息
function getVideoError(error) {
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

// 键盘快捷键
document.addEventListener('keydown', handleKeydown);