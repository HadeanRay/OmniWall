const { app, ipcMain } = require('electron');
const fs = require('fs');
const ConfigManager = require('../config/config-manager');
const WindowManager = require('../services/window-manager');
const TvShowScanner = require('../services/tv-show-scanner');
const SubtitleManager = require('../services/subtitle-manager');
const BangumiAPI = require('../services/bangumi-api');

class AppManager {
  constructor() {
    this.configManager = new ConfigManager();
    this.windowManager = new WindowManager(this.configManager);
    this.tvShowScanner = new TvShowScanner();
    this.subtitleManager = new SubtitleManager();
    this.bangumiAPI = new BangumiAPI();
    
    this.memoryMonitorInterval = null;
    this.memoryUsageHistory = [];
    
    this.setupIpcHandlers();
    this.setupAppEventHandlers();
  }

  setupIpcHandlers() {
    // 窗口控制
    ipcMain.on('window-control', (event, action) => {
      const focusedWindow = this.windowManager.getFocusedWindow();
      if (focusedWindow) {
        if (typeof action === 'string') {
          switch (action) {
            case 'minimize':
              focusedWindow.minimize();
              break;
            case 'toggle-maximize':
              if (focusedWindow.isMaximized()) {
                focusedWindow.unmaximize();
              } else {
                focusedWindow.maximize();
              }
              break;
            case 'close':
              focusedWindow.close();
              break;
            default:
              console.log('未知的窗口控制操作:', action);
          }
        }
      }
    });

    // 设置相关
    ipcMain.on('open-settings', () => {
      this.windowManager.createSettingsWindow();
    });

    ipcMain.on('open-folder-dialog', async (event) => {
      const folderPath = await this.windowManager.showFolderDialog({
        title: '选择文件夹',
        buttonLabel: '选择'
      });
      
      if (folderPath) {
        console.log('用户选择的文件夹:', folderPath);
        event.reply('selected-folder', folderPath);
      }
    });

    ipcMain.on('open-file-dialog', async (event, options) => {
      const filePath = await this.windowManager.showFileDialog(options);
      
      if (filePath) {
        console.log('用户选择的文件:', filePath);
        event.reply('selected-file', filePath);
      }
    });

    ipcMain.on('save-settings', (event, settings) => {
      console.log('保存设置:', settings);
      const success = this.configManager.saveSettings(settings);
      if (success) {
        console.log('设置已保存到本地存储');
      } else {
        console.error('设置保存失败');
      }
    });

    ipcMain.on('load-settings', (event) => {
      const settings = this.configManager.loadSettings();
      console.log('加载设置:', settings);
      event.reply('settings-loaded', settings);
    });

    // 播放进度相关
    ipcMain.on('load-playback-progress', (event) => {
      const playbackProgress = this.configManager.loadPlaybackProgress();
      console.log('加载播放进度:', Object.keys(playbackProgress).length, '个视频的进度');
      event.reply('playback-progress-loaded', { playbackProgress });
    });

    ipcMain.on('save-playback-progress', (event, progressData) => {
      console.log('保存播放进度请求:', progressData.videoPath);
      const success = this.configManager.savePlaybackProgress(progressData);
      if (!success) {
        console.error('播放进度保存失败');
      }
    });

    // 最后播放记录相关
    ipcMain.on('save-last-played', (event, lastPlayedData) => {
      console.log('保存最后播放记录请求:', lastPlayedData.tvShowPath);
      const success = this.configManager.saveLastPlayed(lastPlayedData);
      if (!success) {
        console.error('最后播放记录保存失败');
      }
    });

    ipcMain.on('get-last-played', (event, data) => {
      const { tvShowPath } = data;
      console.log('获取最后播放记录请求:', tvShowPath);
      
      const allRecords = this.configManager.loadLastPlayed();
      const lastPlayed = allRecords[tvShowPath] || null;
      
      console.log('返回最后播放记录:', lastPlayed);
      event.reply('last-played-loaded', {
        lastPlayed: lastPlayed
      });
    });

    // 字幕设置相关
    ipcMain.on('save-subtitle-setting', (event, subtitleSettingsData) => {
      console.log('保存字幕设置请求:', subtitleSettingsData.tvShowPath, '第', subtitleSettingsData.season, '季');
      const success = this.configManager.saveSubtitleSettings(subtitleSettingsData);
      if (!success) {
        console.error('字幕设置保存失败');
      }
    });

    ipcMain.on('get-subtitle-setting', (event, data) => {
      const { tvShowPath, season } = data;
      console.log('获取字幕设置请求:', tvShowPath, '第', season, '季');
      
      const allSettings = this.configManager.loadSubtitleSettings();
      const subtitleSetting = allSettings[tvShowPath] ? allSettings[tvShowPath][season] || null : null;
      
      console.log('返回字幕设置:', subtitleSetting);
      event.reply('subtitle-setting-loaded', {
        subtitleSetting: subtitleSetting
      });
    });

    // 电视剧相关
    ipcMain.on('refresh-tv-shows', () => {
      const mainWindow = this.windowManager.mainWindow;
      if (mainWindow && !mainWindow.isDestroyed()) {
        const settings = this.configManager.loadSettings();
        const tvShows = this.tvShowScanner.scanTvShows(settings.filePath || '');
        mainWindow.webContents.send('tv-shows-scanned', { tvShows });
      }
    });

    ipcMain.on('scan-tv-shows', async (event) => {
      try {
        const settings = this.configManager.loadSettings();
        const tvFolderPath = settings.filePath;
        
        if (!tvFolderPath) {
          event.reply('tv-shows-scanned', { error: '请先设置电视剧文件夹路径' });
          return;
        }
        
        if (!fs.existsSync(tvFolderPath)) {
          event.reply('tv-shows-scanned', { error: '文件夹路径不存在' });
          return;
        }
        
        const tvShows = this.tvShowScanner.scanTvShows(tvFolderPath);
        console.log(`扫描到 ${tvShows.length} 个电视剧`);
        event.reply('tv-shows-scanned', { tvShows });
      } catch (error) {
        console.error('扫描电视剧出错:', error);
        event.reply('tv-shows-scanned', { error: error.message });
      }
    });

    ipcMain.on('play-tv-show', (event, tvShowData) => {
      console.log('收到播放请求:', tvShowData.name);
      this.windowManager.createPlayerWindow(tvShowData);
    });

    ipcMain.on('get-seasons', (event, data) => {
      const { tvShowPath } = data;
      console.log('收到获取季列表请求，路径:', tvShowPath);
      const seasons = this.tvShowScanner.scanSeasons(tvShowPath);
      console.log('扫描到的季列表:', seasons);
      event.reply('seasons-loaded', {
        seasons
      });
    });

    ipcMain.on('get-season-episodes', (event, data) => {
      const { tvShowName, tvShowPath, season } = data;
      console.log('收到获取季集数据请求，路径:', tvShowPath, '季:', season);
      const episodes = this.tvShowScanner.scanEpisodes(tvShowPath, season);
      console.log('扫描到的集数据:', episodes);
      event.reply('season-episodes-loaded', {
        tvShowName,
        season,
        episodes
      });
    });

    // 字幕相关
    ipcMain.on('extract-subtitles', async (event, data) => {
      const { folderPath, ffmpegPath } = data;
      console.log('收到字幕提取请求，路径:', folderPath, 'ffmpeg路径:', ffmpegPath);
      
      try {
        await this.subtitleManager.extractSubtitlesFromFolder(folderPath, ffmpegPath, (progressData) => {
          event.reply('subtitle-extract-progress', progressData);
        });
      } catch (error) {
        console.error('字幕提取失败:', error);
        event.reply('subtitle-extract-progress', {
          status: 'error',
          message: error.message
        });
      }
    });

    // 清除字幕缓存
    ipcMain.on('clear-subtitle-cache', (event) => {
      console.log('收到清除字幕缓存请求');
      this.subtitleManager.clearCache();
      event.reply('subtitle-cache-cleared', {
        status: 'success',
        message: '字幕缓存已清除'
      });
    });

    ipcMain.on('check-external-subtitles', async (event, data) => {
      const { videoPath } = data;
      console.log('收到检查外部字幕文件请求，视频文件:', videoPath);
      
      try {
        const subtitles = this.tvShowScanner.scanExternalSubtitles(videoPath);
        console.log('找到的外部字幕文件:', subtitles);
        event.reply('external-subtitles-loaded', {
          status: 'success',
          subtitles: subtitles
        });
      } catch (error) {
        console.error('检查外部字幕文件失败:', error);
        event.reply('external-subtitles-loaded', {
          status: 'error',
          message: error.message
        });
      }
    });

    // 使用 fluent-ffmpeg 的字幕提取请求
    ipcMain.on('extract-subtitles-fluent', async (event, data) => {
      const { videoFile, outputDir } = data;
      console.log('收到 fluent-ffmpeg 字幕提取请求，视频文件:', videoFile, '输出目录:', outputDir);
      
      try {
        const result = await SubtitleManager.extractAllSubtitles(videoFile, outputDir);
        console.log('字幕提取成功:', result);
        event.reply('subtitle-extract-fluent-complete', {
          status: 'success',
          files: result
        });
      } catch (error) {
        console.error('字幕提取失败:', error);
        event.reply('subtitle-extract-fluent-complete', {
          status: 'error',
          message: error.message
        });
      }
    });

    ipcMain.on('get-subtitle-streams-info', async (event, data) => {
      const { videoFile } = data;
      console.log('收到获取字幕流信息请求，视频文件:', videoFile);
      
      try {
        const streams = await SubtitleManager.getSubtitleStreamsInfo(videoFile);
        console.log('字幕流信息:', streams);
        event.reply('subtitle-streams-info-loaded', {
          status: 'success',
          streams: streams
        });
      } catch (error) {
        console.error('获取字幕流信息失败:', error);
        event.reply('subtitle-streams-info-loaded', {
          status: 'error',
          message: error.message
        });
      }
    });

    ipcMain.on('extract-single-subtitle', async (event, data) => {
      const { videoFile, streamIndex, outputFile } = data;
      console.log('收到提取单个字幕流请求，视频文件:', videoFile, '流索引:', streamIndex, '输出文件:', outputFile);
      
      try {
        const success = await SubtitleManager.extractSubtitleStream(videoFile, streamIndex, outputFile);
        if (success) {
          event.reply('single-subtitle-extracted', {
            status: 'success',
            filePath: outputFile
          });
        } else {
          event.reply('single-subtitle-extracted', {
            status: 'error',
            message: '字幕提取失败'
          });
        }
      } catch (error) {
        console.error('提取单个字幕流失败:', error);
        event.reply('single-subtitle-extracted', {
          status: 'error',
          message: error.message
        });
      }
    });
    
    // Bangumi相关
    ipcMain.on('bangumi-set-token', (event, token) => {
      console.log('设置Bangumi token');
      this.bangumiAPI.setToken(token);
      // 保存到配置
      const settings = this.configManager.loadSettings();
      settings.bangumiToken = token;
      this.configManager.saveSettings(settings);
    });

    ipcMain.on('bangumi-get-collection', async (event, params) => {
      try {
        console.log('获取Bangumi收藏列表, 参数:', params);
        
        // 检查是否有token
        const settings = this.configManager.loadSettings();
        if (!settings.bangumiToken) {
          event.reply('bangumi-collection-loaded', {
            status: 'error',
            message: '未设置Bangumi token'
          });
          return;
        }
        
        // 设置token
        this.bangumiAPI.setToken(settings.bangumiToken);
        
        // 获取用户信息以确认token有效并获取用户名
        let userInfo;
        try {
          userInfo = await this.bangumiAPI.getUserInfo();
          console.log('用户信息:', userInfo.username);
          this.bangumiAPI.setUsername(userInfo.username);
        } catch (userInfoError) {
          console.error('获取用户信息失败:', userInfoError.message);
          event.reply('bangumi-collection-loaded', {
            status: 'error',
            message: 'Bangumi token无效或已过期: ' + userInfoError.message
          });
          return;
        }
        
        // 获取收藏
        const collection = await this.bangumiAPI.getMyCollection(params);
        console.log(`获取到 ${collection.total || collection.data?.length || 0} 个收藏项`);
        
        event.reply('bangumi-collection-loaded', {
          status: 'success',
          collection: collection
        });
      } catch (error) {
        console.error('获取Bangumi收藏失败:', error);
        event.reply('bangumi-collection-loaded', {
          status: 'error',
          message: error.message
        });
      }
    });

    ipcMain.on('bangumi-get-subject', async (event, subjectId) => {
      try {
        console.log('获取Bangumi条目详情:', subjectId);
        
        // 检查是否有token
        const settings = this.configManager.loadSettings();
        if (!settings.bangumiToken) {
          event.reply('bangumi-subject-loaded', {
            status: 'error',
            message: '未设置Bangumi token'
          });
          return;
        }
        
        // 设置token
        this.bangumiAPI.setToken(settings.bangumiToken);
        
        // 获取条目详情
        const subject = await this.bangumiAPI.getSubject(subjectId);
        console.log('获取到条目详情:', subject.name);
        
        event.reply('bangumi-subject-loaded', {
          status: 'success',
          subject: subject
        });
      } catch (error) {
        console.error('获取Bangumi条目详情失败:', error);
        event.reply('bangumi-subject-loaded', {
          status: 'error',
          message: error.message
        });
      }
    });
    
    // 打开测试海报墙窗口
    ipcMain.on('open-test-poster-wall', () => {
      console.log('收到打开测试海报墙窗口请求');
      this.windowManager.createTestPosterWallWindow();
    });
  }

  setupAppEventHandlers() {
    app.whenReady().then(() => {
      this.windowManager.createMainWindow();
      this.startMemoryMonitoring();
    });

    app.on('activate', () => {
      if (this.windowManager.getAllWindows().length === 0) {
        this.windowManager.createMainWindow();
      }
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        this.stopMemoryMonitoring();
        app.quit();
      }
    });

    app.on('before-quit', () => {
      console.log('应用即将退出，清理资源...');
      this.stopMemoryMonitoring();
    });

    // 全局错误处理
    process.on('uncaughtException', (error) => {
      console.error('未捕获的异常:', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('未处理的Promise拒绝:', reason);
    });

    // 启用垃圾回收暴露（用于调试）
    if (process.env.NODE_ENV === 'development') {
      const v8 = require('v8');
      v8.setFlagsFromString('--expose_gc');
    }
  }

  startMemoryMonitoring() {
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
    }
    
    this.memoryMonitorInterval = setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const currentTime = Date.now();
      
      this.memoryUsageHistory.push({
        timestamp: currentTime,
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024)
      });
      
      if (this.memoryUsageHistory.length > 100) {
        this.memoryUsageHistory = this.memoryUsageHistory.slice(-100);
      }
      
      if (currentTime % 30000 < 5000) {
        console.log('内存使用情况:', {
          rss: this.memoryUsageHistory[this.memoryUsageHistory.length - 1].rss + 'MB',
          heapTotal: this.memoryUsageHistory[this.memoryUsageHistory.length - 1].heapTotal + 'MB',
          heapUsed: this.memoryUsageHistory[this.memoryUsageHistory.length - 1].heapUsed + 'MB',
          external: this.memoryUsageHistory[this.memoryUsageHistory.length - 1].external + 'MB'
        });
      }
    }, 5000);
  }

  stopMemoryMonitoring() {
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
      this.memoryMonitorInterval = null;
    }
  }
}

module.exports = AppManager;