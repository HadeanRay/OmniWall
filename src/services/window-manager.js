const { BrowserWindow, dialog } = require('electron');
const path = require('path');

class WindowManager {
  constructor(configManager) {
    this.configManager = configManager;
    this.tvShowScanner = new (require('./tv-show-scanner'))();
    this.mainWindow = null;
    this.playerWindows = [];
  }

  createMainWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      frame: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true
      }
    });

    // 仅在开发环境中启用开发者工具
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.webContents.openDevTools();
    }

    this.mainWindow.loadFile(path.join(__dirname, '../renderer/main/index.html'));

    this.mainWindow.webContents.once('did-finish-load', () => {
      const settings = this.configManager.loadSettings();
      if (settings.filePath) {
        const tvShows = this.tvShowScanner.scanTvShows(settings.filePath);
        this.mainWindow.webContents.send('tv-shows-scanned', { tvShows });
      }
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    return this.mainWindow;
  }

  createSettingsWindow() {
    const settingsWindow = new BrowserWindow({
      width: 800,
      height: 600,
      parent: this.mainWindow,
      modal: true,
      resizable: false,
      frame: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true
      }
    });

    settingsWindow.loadFile(path.join(__dirname, '../renderer/settings/settings.html'));
    settingsWindow.on('closed', () => {
      // 窗口关闭时自动清理
    });

    return settingsWindow;
  }

  

  createPlayerWindow(tvShowData) {
    const playerWindow = new BrowserWindow({
      width: 2240,
      height: 1080,
      parent: this.mainWindow,
      modal: false,
      resizable: true,
      center: true,
      frame: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true
      }
    });

    // 仅在开发环境中启用开发者工具
    if (process.env.NODE_ENV === 'development') {
      playerWindow.webContents.openDevTools();
    }

    this.playerWindows.push(playerWindow);
    console.log(`创建播放器窗口，当前窗口数量: ${this.playerWindows.length}`);

    playerWindow.loadFile(path.join(__dirname, '../renderer/player/player.html'));

    playerWindow.webContents.once('did-finish-load', () => {
      console.log('播放器窗口加载完成，发送播放数据:', {
        name: tvShowData.name,
        path: tvShowData.path,
        firstEpisode: tvShowData.firstEpisode
      });
      
      playerWindow.webContents.send('play-video', {
        tvShowName: tvShowData.name,
        tvShowPath: tvShowData.path,
        videoPath: tvShowData.firstEpisode
      });
    });

    playerWindow.on('close', () => {
      console.log('播放器窗口即将关闭，清理资源...');
      playerWindow.webContents.send('window-closing');
    });

    playerWindow.on('closed', () => {
      console.log('播放器窗口已关闭');
      const index = this.playerWindows.indexOf(playerWindow);
      if (index > -1) {
        this.playerWindows.splice(index, 1);
      }
      console.log(`播放器窗口已移除，当前窗口数量: ${this.playerWindows.length}`);
    });

    return playerWindow;
  }

  async showFolderDialog(options = {}) {
    const result = await dialog.showOpenDialog(this.mainWindow, {
      properties: ['openDirectory'],
      title: options.title || '选择文件夹',
      buttonLabel: options.buttonLabel || '选择'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  }

  async showFileDialog(options = {}) {
    const result = await dialog.showOpenDialog(this.mainWindow, {
      properties: ['openFile'],
      title: options.title || '选择文件',
      buttonLabel: options.buttonLabel || '选择',
      filters: options.filters || [
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  }

  getFocusedWindow() {
    return BrowserWindow.getFocusedWindow();
  }

  getAllWindows() {
    return BrowserWindow.getAllWindows();
  }

  cleanupPlayerWindows() {
    console.log(`强制清理播放器窗口，当前数量: ${this.playerWindows.length}`);
    
    const windowsToClose = [...this.playerWindows];
    
    windowsToClose.forEach((window, index) => {
      if (window && !window.isDestroyed()) {
        console.log(`关闭播放器窗口 ${index + 1}`);
        window.close();
      }
    });
    
    this.playerWindows = [];
    console.log('所有播放器窗口已清理');
  }
}

module.exports = WindowManager;