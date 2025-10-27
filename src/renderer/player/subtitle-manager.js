class SubtitleManager {
    constructor(playerController) {
        this.playerController = playerController;
        this.subtitles = [];
        this.currentSubtitle = null;
        this.subtitleMenuVisible = false;
        this.subtitleSettings = {};
        
        // 绑定方法以确保正确的this上下文
        this.closeSubtitleMenuOnClick = this.closeSubtitleMenuOnClick.bind(this);
        
        this.initialize();
    }

    initialize() {
        // 绑定IPC事件
        const { ipcRenderer } = require('electron');
        ipcRenderer.on('external-subtitles-loaded', (event, data) => {
            this.onExternalSubtitlesLoaded(data);
        });
        
        ipcRenderer.on('subtitle-setting-loaded', (event, data) => {
            this.onSubtitleSettingLoaded(data);
        });
        
        console.log('字幕管理器初始化完成');
    }

    // 字幕设置功能
    openSubtitleSettings() {
        this.toggleSubtitleMenu();
    }

    // 切换字幕菜单显示/隐藏
    toggleSubtitleMenu() {
        const subtitleMenu = document.getElementById('subtitleMenu');
        
        if (this.subtitleMenuVisible) {
            // 隐藏菜单
            subtitleMenu.classList.remove('active');
            this.subtitleMenuVisible = false;
            document.removeEventListener('click', this.closeSubtitleMenuOnClick.bind(this), true);
        } else {
            // 显示菜单前先加载字幕列表
            this.loadSubtitles();
            subtitleMenu.classList.add('active');
            this.subtitleMenuVisible = true;
            
            // 强制重新渲染字幕列表，确保显示最新的字幕选项和当前选择状态
            this.renderSubtitleList(this.subtitles);
            
            // 点击其他地方关闭菜单
            setTimeout(() => {
                document.addEventListener('click', this.closeSubtitleMenuOnClick.bind(this), true);
            }, 100);
        }
    }

    // 点击其他地方关闭字幕菜单
    closeSubtitleMenuOnClick(event) {
        const subtitleMenu = document.getElementById('subtitleMenu');
        const subtitleLink = document.querySelector('.setting-link[onclick="openSubtitleSettings()"]');
        
        // 安全检查：如果元素不存在，直接返回
        if (!subtitleMenu || !subtitleLink) {
            console.warn('字幕菜单或字幕链接元素未找到');
            document.removeEventListener('click', this.closeSubtitleMenuOnClick, true);
            return;
        }
        
        if (!subtitleMenu.contains(event.target) && event.target !== subtitleLink && !subtitleLink.contains(event.target)) {
            subtitleMenu.classList.remove('active');
            this.subtitleMenuVisible = false;
            document.removeEventListener('click', this.closeSubtitleMenuOnClick, true);
        }
    }

    // 加载字幕列表
    loadSubtitles() {
        if (!this.playerController.videoPlayer || !this.playerController.videoPlayer.src) {
            console.log('没有视频文件，无法加载字幕');
            this.renderSubtitleList([]);
            return;
        }
        
        // 获取当前视频文件的路径，解码URL编码的路径
        let videoPath = this.playerController.videoPlayer.src.replace('file://', '');
        videoPath = decodeURIComponent(videoPath);
        
        // 修复路径问题：如果路径以 /X:/ 开头，则移除开头的斜杠
        if (videoPath.startsWith('/')) {
            videoPath = videoPath.substring(1);
        }
        
        console.log('加载字幕，视频路径:', videoPath);
        
        // 向主进程请求字幕文件
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('check-external-subtitles', {
            videoPath: videoPath
        });
    }

    // 保存字幕设置
    saveSubtitleSetting(subtitleIndex) {
        if (!this.playerController.currentTvShowPath || !this.playerController.currentSeason) {
            console.log('无法保存字幕设置: 电视剧路径或季信息缺失');
            return;
        }

        const subtitleSetting = {
            subtitleIndex: subtitleIndex,
            timestamp: Date.now()
        };

        console.log('保存字幕设置:', subtitleSetting);
        
        // 发送到主进程保存
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('save-subtitle-setting', {
            tvShowPath: this.playerController.currentTvShowPath,
            season: this.playerController.currentSeason,
            subtitleSetting: subtitleSetting
        });
    }

    // 加载字幕设置
    loadSubtitleSetting() {
        if (!this.playerController.currentTvShowPath || !this.playerController.currentSeason) {
            console.log('无法加载字幕设置: 电视剧路径或季信息缺失');
            return;
        }

        console.log('加载字幕设置:', this.playerController.currentTvShowPath, '第', this.playerController.currentSeason, '季');
        
        // 向主进程请求字幕设置
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('get-subtitle-setting', {
            tvShowPath: this.playerController.currentTvShowPath,
            season: this.playerController.currentSeason
        });
    }

    // 应用字幕设置
    applySubtitleSetting(subtitleSetting) {
        if (!subtitleSetting || subtitleSetting.subtitleIndex === null) {
            console.log('无字幕设置或设置为无字幕');
            return;
        }

        console.log('应用字幕设置:', subtitleSetting, '菜单状态:', this.subtitleMenuVisible);
        
        // 检查字幕文件是否已加载
        if (this.subtitles.length > 0) {
            const subtitleIndex = subtitleSetting.subtitleIndex;
            
            // 如果字幕菜单当前是打开的，不要调用selectSubtitle，避免关闭菜单
            if (this.subtitleMenuVisible) {
                console.log('字幕菜单已打开，跳过自动选择字幕');
                return;
            }
            
            if (subtitleIndex === null) {
                // 关闭字幕
                this.selectSubtitle(null);
            } else if (subtitleIndex >= 0 && subtitleIndex < this.subtitles.length) {
                // 选择指定的字幕
                this.selectSubtitle(subtitleIndex);
            } else {
                console.log('字幕索引无效:', subtitleIndex, '字幕总数:', this.subtitles.length);
                // 如果设置的字幕索引无效，自动选择第一个字幕
                if (this.subtitles.length > 0) {
                    console.log('自动选择第一个字幕作为备用');
                    this.selectSubtitle(0);
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
                        this.applySubtitleSetting(subtitleSetting);
                    }, 100);
                }
            };
            
            // 添加一次性事件监听器
            const { ipcRenderer } = require('electron');
            ipcRenderer.once('external-subtitles-loaded', applySettingHandler);
        }
    }

    // 检查并自动选择第一个外部字幕
    autoSelectFirstExternalSubtitle() {
        if (this.subtitles.length > 0) {
            // 如果有外部字幕，自动选择第一个
            console.log('自动选择第一个外部字幕');
            this.selectSubtitle(0);
            // 保存设置
            this.saveSubtitleSetting(0);
        }
    }

    // 渲染字幕列表
    renderSubtitleList(subtitles) {
        const subtitleList = document.getElementById('subtitleList');
        
        if (!subtitles || subtitles.length === 0) {
            subtitleList.innerHTML = '<div class="no-subtitles">未找到字幕文件</div>';
            return;
        }
        
        let html = '';
        
        // "无字幕"选项
        html += `
            <div class="subtitle-item ${this.currentSubtitle === null ? 'active' : ''}" onclick="window.playerManager.subtitleManager.selectSubtitle(null)">
                <div class="subtitle-info">
                    <div class="subtitle-type">无字幕</div>
                </div>
                ${this.currentSubtitle === null ? '<span class="subtitle-status">✓</span>' : ''}
            </div>
        `;
        
        // 字幕文件选项
        subtitles.forEach((subtitle, index) => {
            const isActive = this.currentSubtitle && this.currentSubtitle.path === subtitle.path;
            html += `
                <div class="subtitle-item ${isActive ? 'active' : ''}" onclick="window.playerManager.subtitleManager.selectSubtitle(${index})">
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
    selectSubtitle(index) {
        const subtitleMenu = document.getElementById('subtitleMenu');
        subtitleMenu.classList.remove('active');
        this.subtitleMenuVisible = false;
        document.removeEventListener('click', this.closeSubtitleMenuOnClick, true);
        
        if (index === null) {
            // 关闭字幕
            this.currentSubtitle = null;
            this.removeSubtitleTrack();
            console.log('关闭字幕');
            // 保存设置
            this.saveSubtitleSetting(null);
        } else if (this.subtitles[index]) {
            // 选择字幕文件
            this.currentSubtitle = this.subtitles[index];
            this.loadSubtitleFile(this.currentSubtitle.path);
            console.log('选择字幕:', this.currentSubtitle.name);
            // 保存设置
            this.saveSubtitleSetting(index);
        }
        
        // 更新字幕列表显示
        this.renderSubtitleList(this.subtitles);
    }

    // 加载字幕文件
    loadSubtitleFile(subtitlePath) {
        if (!this.playerController.videoPlayer) return;
        
        // 移除已有的字幕轨道
        this.removeSubtitleTrack();
        
        // 创建新的字幕轨道
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.src = `file://${subtitlePath}`;
        track.srclang = 'zh'; // 默认为中文
        track.label = this.currentSubtitle ? `${this.currentSubtitle.type} - ${this.currentSubtitle.language}` : '字幕';
        track.default = true;
        
        this.playerController.videoPlayer.appendChild(track);
        
        // 启用字幕
        this.playerController.videoPlayer.textTracks[0].mode = 'showing';
        
        console.log('字幕文件已加载:', subtitlePath);
    }

    // 移除字幕轨道
    removeSubtitleTrack() {
        if (!this.playerController.videoPlayer) return;
        
        const tracks = this.playerController.videoPlayer.querySelectorAll('track');
        tracks.forEach(track => {
            this.playerController.videoPlayer.removeChild(track);
        });
        
        console.log('字幕轨道已移除');
    }

    // 事件处理函数
    onExternalSubtitlesLoaded(data) {
        if (data.status === 'success') {
            this.subtitles = data.subtitles;
            console.log('接收到字幕文件列表:', this.subtitles);
            
            // 只有在字幕菜单未显示时才重新渲染列表
            // 避免在菜单打开时重新渲染导致菜单关闭
            if (!this.subtitleMenuVisible) {
                this.renderSubtitleList(this.subtitles);
            }
            
            // 如果有外部字幕，检查是否有保存的设置
            // 但只在字幕菜单未显示时加载设置，避免菜单打开时自动选择字幕
            if (this.subtitles.length > 0 && !this.subtitleMenuVisible) {
                console.log('有外部字幕可用，加载字幕设置...');
                this.loadSubtitleSetting();
            } else if (this.subtitles.length > 0 && this.subtitleMenuVisible) {
                console.log('字幕菜单已打开，跳过自动加载设置');
            } else {
                console.log('无外部字幕文件');
            }
        } else {
            console.error('获取字幕文件失败:', data.message);
            if (!this.subtitleMenuVisible) {
                this.renderSubtitleList([]);
            }
        }
    }

    onSubtitleSettingLoaded(data) {
        if (data && data.subtitleSetting !== null) {
            console.log('字幕设置已加载:', data.subtitleSetting);
            // 应用字幕设置
            this.applySubtitleSetting(data.subtitleSetting);
        }
    }

    // 清理方法
    cleanup() {
        console.log('清理字幕管理器资源...');
        
        // 移除字幕轨道
        this.removeSubtitleTrack();
        
        // 移除事件监听器
        const { ipcRenderer } = require('electron');
        ipcRenderer.removeAllListeners('external-subtitles-loaded');
        ipcRenderer.removeAllListeners('subtitle-setting-loaded');
        
        console.log('字幕管理器资源清理完成');
    }
}

// 导出类供其他模块使用
module.exports = SubtitleManager;