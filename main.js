const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 内存监控
let memoryMonitorInterval = null;
let memoryUsageHistory = [];

function startMemoryMonitoring() {
    if (memoryMonitorInterval) {
        clearInterval(memoryMonitorInterval);
    }
    
    memoryMonitorInterval = setInterval(() => {
        const memoryUsage = process.memoryUsage();
        const currentTime = Date.now();
        
        memoryUsageHistory.push({
            timestamp: currentTime,
            rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
            external: Math.round(memoryUsage.external / 1024 / 1024) // MB
        });
        
        // 只保留最近100条记录
        if (memoryUsageHistory.length > 100) {
            memoryUsageHistory = memoryUsageHistory.slice(-100);
        }
        
        // 每30秒输出一次内存使用情况
        if (currentTime % 30000 < 5000) {
            console.log('内存使用情况:', {
                rss: memoryUsageHistory[memoryUsageHistory.length - 1].rss + 'MB',
                heapTotal: memoryUsageHistory[memoryUsageHistory.length - 1].heapTotal + 'MB',
                heapUsed: memoryUsageHistory[memoryUsageHistory.length - 1].heapUsed + 'MB',
                external: memoryUsageHistory[memoryUsageHistory.length - 1].external + 'MB'
            });
        }
    }, 5000); // 每5秒检查一次
}

function stopMemoryMonitoring() {
    if (memoryMonitorInterval) {
        clearInterval(memoryMonitorInterval);
        memoryMonitorInterval = null;
    }
}

// 强制清理所有播放器窗口
function cleanupPlayerWindows() {
    console.log(`强制清理播放器窗口，当前数量: ${playerWindows.length}`);
    
    // 创建副本以避免在循环中修改数组
    const windowsToClose = [...playerWindows];
    
    windowsToClose.forEach((window, index) => {
        if (window && !window.isDestroyed()) {
            console.log(`关闭播放器窗口 ${index + 1}`);
            window.close();
        }
    });
    
    playerWindows = [];
    console.log('所有播放器窗口已清理');
}

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

// 设置文件路径
const settingsPath = path.join(os.homedir(), '.omniwall', 'settings.json');

// 确保设置目录存在
const settingsDir = path.dirname(settingsPath);
if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
}

// 加载设置
function loadSettings() {
    try {
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('加载设置失败:', error);
    }
    return {};
}

// 保存设置
function saveSettings(settings) {
    try {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        return true;
    } catch (error) {
        console.error('保存设置失败:', error);
        return false;
    }
}

let mainWindow = null;
let playerWindows = []; // 跟踪所有播放器窗口

function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  // 加载应用的index.html文件
  mainWindow.loadFile('index.html');

  // 打开开发者工具，方便调试
  mainWindow.webContents.openDevTools();

  // 页面加载完成后自动扫描电视剧
  mainWindow.webContents.once('did-finish-load', () => {
    const settings = loadSettings();
    if (settings.filePath) {
      const tvShows = scanTvShows(settings.filePath);
      mainWindow.webContents.send('tv-shows-scanned', { tvShows });
    }
  });

  // 当窗口关闭时触发
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// 创建设置窗口
function createSettingsWindow() {
  // 创建设置窗口
  let settingsWindow = new BrowserWindow({
    width: 800,
    height: 600,
    parent: mainWindow, // 设置为主窗口的子窗口
    modal: true, // 模态窗口
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  // 加载设置页面
  settingsWindow.loadFile('settings.html');

  // 关闭窗口时释放引用
  settingsWindow.on('closed', function () {
    settingsWindow = null;
  });
}

// 监听打开设置窗口的请求
ipcMain.on('open-settings', () => {
  createSettingsWindow();
});

// 监听打开文件夹对话框的请求
ipcMain.on('open-folder-dialog', async (event) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择文件夹',
    buttonLabel: '选择'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const folderPath = result.filePaths[0];
    console.log('用户选择的文件夹:', folderPath);
    // 将选择的文件夹路径发送回渲染进程
    event.reply('selected-folder', folderPath);
  }
});

// 监听保存设置的请求
ipcMain.on('save-settings', (event, settings) => {
  console.log('保存设置:', settings);
  const success = saveSettings(settings);
  if (success) {
    console.log('设置已保存到本地存储:', settingsPath);
  } else {
    console.error('设置保存失败');
  }
});

// 监听加载设置的请求
ipcMain.on('load-settings', (event) => {
  const settings = loadSettings();
  console.log('加载设置:', settings);
  event.reply('settings-loaded', settings);
});

// 监听刷新电视剧列表的请求
ipcMain.on('refresh-tv-shows', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tv-shows-scanned', { 
      tvShows: scanTvShows(loadSettings().filePath || '') 
    });
  }
});

// 监听播放电视剧的请求
let tvShowHandlers = [];

ipcMain.on('play-tv-show', (event, tvShowData) => {
  console.log('收到播放请求:', tvShowData.name);
  createPlayerWindow(tvShowData);
});

// 监听获取季集数据的请求
ipcMain.on('get-season-episodes', (event, data) => {
  const { tvShowName, tvShowPath, season } = data;
  console.log('收到获取季集数据请求，路径:', tvShowPath, '季:', season);
  const episodes = scanEpisodes(tvShowPath, season);
  console.log('扫描到的集数据:', episodes);
  event.reply('season-episodes-loaded', {
    tvShowName,
    season,
    episodes
  });
});

// 监听获取季列表的请求
ipcMain.on('get-seasons', (event, data) => {
  const { tvShowPath } = data;
  console.log('收到获取季列表请求，路径:', tvShowPath);
  const seasons = scanSeasons(tvShowPath);
  console.log('扫描到的季列表:', seasons);
  event.reply('seasons-loaded', {
    seasons
  });
});



























// 创建播放窗口
function createPlayerWindow(tvShowData) {
  // 创建播放窗口
  let playerWindow = new BrowserWindow({
    width: 2240,
    height: 1080, // 2:1比例 (1200:600 = 2:1)
    parent: mainWindow,
    modal: false,
    resizable: true,
    center: true, // 水平和垂直居中
    frame: false, // 不显示标题栏
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  // 添加到跟踪列表
  playerWindows.push(playerWindow);
  console.log(`创建播放器窗口，当前窗口数量: ${playerWindows.length}`);

  // 加载播放页面
  playerWindow.loadFile('player.html');

  // 页面加载完成后发送播放数据
  playerWindow.webContents.once('did-finish-load', () => {
    console.log('播放器窗口加载完成，发送播放数据:', {
      name: tvShowData.name,
      path: tvShowData.path,
      firstEpisode: tvShowData.firstEpisode
    });
    
    // 打开开发者工具以便调试
    // playerWindow.webContents.openDevTools();
    
    playerWindow.webContents.send('play-video', {
      tvShowName: tvShowData.name,
      tvShowPath: tvShowData.path,
      videoPath: tvShowData.firstEpisode
    });
  });

  // 窗口关闭前清理资源
  playerWindow.on('close', (event) => {
    console.log('播放器窗口即将关闭，清理资源...');
    // 可以在这里发送清理消息给渲染进程
    playerWindow.webContents.send('window-closing');
  });

  // 关闭窗口时释放引用
  playerWindow.on('closed', function () {
    console.log('播放器窗口已关闭');
    // 从跟踪列表中移除
    const index = playerWindows.indexOf(playerWindow);
    if (index > -1) {
      playerWindows.splice(index, 1);
    }
    console.log(`播放器窗口已移除，当前窗口数量: ${playerWindows.length}`);
    playerWindow = null;
  });

  return playerWindow;
}

// 扫描季列表
function scanSeasons(tvShowPath) {
  const seasons = [];
  
  try {
    const items = fs.readdirSync(tvShowPath, { withFileTypes: true });
    
    const seasonFolders = items.filter(item => 
      item.isDirectory() && 
      (item.name.toLowerCase().includes('season') || 
       item.name.toLowerCase().includes('s') ||
       item.name.toLowerCase().includes('季') ||
       /^season\s*\d+/i.test(item.name) ||
       /^s\d+/i.test(item.name) ||
       /^第\d+季/.test(item.name))
    );
    
    console.log('找到的季文件夹:', seasonFolders.map(f => f.name));
    
    // 提取季号并排序
    seasonFolders.forEach(folder => {
      const seasonMatch = folder.name.match(/(season\s*|s)(\d+)|(第)(\d+)(季)/i);
      if (seasonMatch) {
        const seasonNumber = parseInt(seasonMatch[2] || seasonMatch[4]);
        if (!isNaN(seasonNumber)) {
          seasons.push({
            number: seasonNumber,
            name: folder.name,
            path: path.join(tvShowPath, folder.name)
          });
        }
      }
    });
    
    // 按季号排序
    seasons.sort((a, b) => a.number - b.number);
    
    console.log('解析后的季列表:', seasons);
    
    // 如果没有找到季文件夹，检查是否有视频文件直接存在，假设只有一季
    if (seasons.length === 0) {
      console.log('未找到季文件夹，检查是否有直接的文件...');
      const allFiles = fs.readdirSync(tvShowPath, { withFileTypes: true });
      const videoFiles = allFiles.filter(item => 
        item.isFile() && 
        ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'].some(ext => 
          item.name.toLowerCase().endsWith(ext)
        )
      );
      
      // 也检查是否有 .nfo 文件（作为剧集指示）
      const nfoFiles = allFiles.filter(item => 
        item.isFile() && 
        item.name.toLowerCase().endsWith('.nfo')
      );
      
      if (videoFiles.length > 0 || nfoFiles.length > 0) {
        console.log(`在根目录找到 ${videoFiles.length} 个视频文件和 ${nfoFiles.length} 个nfo文件，假设为第1季`);
        seasons.push({
          number: 1,
          name: 'Season 1',
          path: tvShowPath
        });
      }
    }
    
  } catch (error) {
    console.error(`扫描季列表出错: ${tvShowPath}`, error);
  }
  
  return seasons;
}

// 扫描指定季的集数
function scanEpisodes(tvShowPath, season) {
  const episodes = [];
  const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'];
  
  try {
    // 获取季文件夹路径
    let seasonPath = tvShowPath;
    // 对于第1季，也需要查找Season 1文件夹
    if (season === 1) {
      const season1Path = path.join(tvShowPath, 'Season 1');
      if (fs.existsSync(season1Path)) {
        seasonPath = season1Path;
      }
    } else if (season > 1) {
      const seasons = scanSeasons(tvShowPath);
      const targetSeason = seasons.find(s => s.number === season);
      if (targetSeason) {
        seasonPath = targetSeason.path;
      }
    }
    
    const items = fs.readdirSync(seasonPath, { withFileTypes: true });
    
    // 首先处理 .nfo 文件，获取更准确的剧集信息
    const processedEpisodes = new Map();
    const nfoFiles = items.filter(item => item.isFile() && item.name.toLowerCase().endsWith('.nfo'));
    
    console.log(`找到 ${nfoFiles.length} 个 nfo 文件`);
    
    // 处理所有nfo文件
    nfoFiles.forEach(nfoItem => {
      const nfoPath = path.join(seasonPath, nfoItem.name);
      
      try {
        // 从nfo文件名中提取集号
        let episodeNumber = null;
        const name = nfoItem.name.toLowerCase();
        
        // 匹配各种集号格式（按优先级从高到低排序）
        const patterns = [
          /s\d{1,2}e(\d{1,3})/i,      // S01E01
          /\[(\d{1,3})\]/,            // [01] 或 [1]
          /第(\d{1,3})[集话]/,        // 第01集、第01话
          /-(\d{1,3})v\d/,            // -01v1 格式
          /-\s*(\d{1,3})v\d/,         // - 01v1 格式（带空格）
          /-\s*(\d{1,3})\s*[\[\-]/,  // - 01 [ 或 - 01 -
          /(\d{1,3})\s*-\s*/,         // 01 -
          /-\s*(\d{1,3})\s*\./,      // - 01 .
          /\s(\d{1,3})\s*[\-\[]/,     // 空格 01 空格 [
          /(\d{1,3})\s*-\s*/,         // 01 - 空格
          /-(\d{1,3})\s*[-\[]/,       // -01 [ 或 -01-
          /\[(\d{1,3})\][^\]]*$/,     // [01] 在末尾
          /^.*\[(\d{1,3})\]/,         // [01] 在任意位置
          /\b(\d{1,3})\b/,            // 直接的数字（最后尝试）
        ];
        
        for (const pattern of patterns) {
          const match = name.match(pattern);
          if (match && match[1]) {
            episodeNumber = parseInt(match[1]);
            console.log(`nfo文件 ${nfoItem.name} 匹配模式 ${pattern}，提取集号: ${episodeNumber}`);
            break;
          }
        }
        
        // 如果还是没找到，尝试更宽松的匹配
        if (episodeNumber === null) {
          const numberMatch = name.match(/(\d{1,3})/);
          if (numberMatch) {
            episodeNumber = parseInt(numberMatch[1]);
            console.log(`nfo文件 ${nfoItem.name} 使用宽松匹配，提取集号: ${episodeNumber}`);
          }
        }
        
        if (episodeNumber !== null) {
          // 查找对应的视频文件
          const baseName = nfoItem.name.replace('.nfo', '');
          const videoFile = items.find(item => 
            item.isFile() && 
            item.name.startsWith(baseName) &&
            videoExtensions.some(ext => item.name.toLowerCase().endsWith(ext))
          );
          
          if (videoFile) {
            processedEpisodes.set(episodeNumber, {
              number: episodeNumber,
              name: baseName, // 使用nfo文件名（不含扩展名）作为显示名称
              path: path.join(seasonPath, videoFile.name),
              nfoPath: nfoPath
            });
          } else {
            console.log(`nfo文件 ${nfoItem.name} 未找到对应的视频文件`);
          }
        }
      } catch (error) {
        console.error(`处理nfo文件失败: ${nfoPath}`, error);
      }
    });
    
    // 如果没有nfo文件，或者需要补充缺失的集数，扫描视频文件
    if (processedEpisodes.size === 0) {
      console.log('未找到有效的nfo文件，扫描视频文件...');
    }
    
    // 扫描剩余的视频文件（对于没有对应nfo文件的视频文件）
    const videoFiles = items
      .filter(item => item.isFile() && 
        videoExtensions.some(ext => item.name.toLowerCase().endsWith(ext)))
      .filter(item => {
        // 检查是否已经有对应的nfo文件处理过
        const baseName = item.name.replace(/\.[^.]+$/, ''); // 去除文件扩展名
        const existingEpisode = Array.from(processedEpisodes.values()).find(
          ep => ep.path === path.join(seasonPath, item.name)
        );
        return !existingEpisode;
      })
      .map(item => {
        // 从文件名中提取集号
        let episodeNumber = null;
        const name = item.name.toLowerCase();
        
        const patterns = [
          /s\d{1,2}e(\d{1,3})/i,
          /\[(\d{1,3})\]/,
          /第(\d{1,3})[集话]/,
          /-(\d{1,3})v\d/,
          /-\s*(\d{1,3})v\d/,
          /-\s*(\d{1,3})\s*[\[\-]/,
          /(\d{1,3})\s*-\s*/,
          /-\s*(\d{1,3})\s*\./,
          /\s(\d{1,3})\s*[\-\[]/,
          /(\d{1,3})\s*-\s*/,
          /-(\d{1,3})\s*[-\[]/,
          /\[(\d{1,3})\][^\]]*$/,
          /^.*\[(\d{1,3})\]/,
          /\b(\d{1,3})\b/,
        ];
        
        for (const pattern of patterns) {
          const match = name.match(pattern);
          if (match && match[1]) {
            episodeNumber = parseInt(match[1]);
            break;
          }
        }
        
        if (episodeNumber === null) {
          const numberMatch = name.match(/(\d{1,3})/);
          if (numberMatch) {
            episodeNumber = parseInt(numberMatch[1]);
          }
        }
        
        return {
          number: episodeNumber,
          name: item.name,
          path: path.join(seasonPath, item.name)
        };
      })
      .filter(file => file.number !== null);
    
    // 将视频文件添加到已处理的剧集中
    videoFiles.forEach(file => {
      if (!processedEpisodes.has(file.number)) {
        processedEpisodes.set(file.number, file);
      }
    });
    
    // 按集号排序并构建最终剧集列表
    const sortedEpisodes = Array.from(processedEpisodes.values()).sort((a, b) => a.number - b.number);
    
    console.log(`最终剧集列表:`, sortedEpisodes.map(f => ({ 
      number: f.number, 
      name: f.name,
      hasNfo: !!f.nfoPath 
    })));
    
    episodes.push(...sortedEpisodes);
    
  } catch (error) {
    console.error(`扫描集数出错: ${tvShowPath} 季 ${season}`, error);
  }
  
  return episodes;
}

// 监听扫描电视剧文件夹的请求
ipcMain.on('scan-tv-shows', async (event) => {
  try {
    const settings = loadSettings();
    const tvFolderPath = settings.filePath;
    
    if (!tvFolderPath) {
      event.reply('tv-shows-scanned', { error: '请先设置电视剧文件夹路径' });
      return;
    }
    
    if (!fs.existsSync(tvFolderPath)) {
      event.reply('tv-shows-scanned', { error: '文件夹路径不存在' });
      return;
    }
    
    const tvShows = scanTvShows(tvFolderPath);
    console.log(`扫描到 ${tvShows.length} 个电视剧`);
    event.reply('tv-shows-scanned', { tvShows });
  } catch (error) {
    console.error('扫描电视剧出错:', error);
    event.reply('tv-shows-scanned', { error: error.message });
  }
});

// 扫描电视剧文件夹
function scanTvShows(folderPath) {
  const tvShows = [];
  
  try {
    const items = fs.readdirSync(folderPath, { withFileTypes: true });
    
    for (const item of items) {
      if (item.isDirectory() && !item.name.startsWith('.')) {
        const tvShowPath = path.join(folderPath, item.name);
        const posterPath = findPoster(tvShowPath);
        const firstEpisode = findFirstEpisode(tvShowPath);
        
        tvShows.push({
          name: item.name,
          path: tvShowPath,
          poster: posterPath,
          firstEpisode: firstEpisode
        });
      }
    }
  } catch (error) {
    console.error('扫描文件夹出错:', error);
  }
  
  return tvShows;
}

// 查找海报图片
function findPoster(tvShowPath) {
  try {
    const items = fs.readdirSync(tvShowPath);
    
    // 优先查找poster.jpg
    const posterFile = items.find(item => 
      item.toLowerCase() === 'poster.jpg' || 
      item.toLowerCase() === 'poster.png'
    );
    
    if (posterFile) {
      return path.join(tvShowPath, posterFile);
    }
    
    // 如果没有poster文件，查找第一个-thumb.jpg文件
    const thumbFile = items.find(item => 
      item.toLowerCase().includes('-thumb.jpg')
    );
    
    if (thumbFile) {
      return path.join(tvShowPath, thumbFile);
    }
    
    // 如果没有找到海报，返回null
    return null;
  } catch (error) {
    console.error(`查找海报出错: ${tvShowPath}`, error);
    return null;
  }
}

// 查找第一季第一集视频文件
function findFirstEpisode(tvShowPath) {
  try {
    // 支持的视频文件扩展名
    const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'];
    
    // 首先查找 Season 1 文件夹
    const season1Path = path.join(tvShowPath, 'Season 1');
    if (fs.existsSync(season1Path) && fs.statSync(season1Path).isDirectory()) {
      return findFirstVideoFile(season1Path, videoExtensions);
    }
    
    // 如果没有 Season 1 文件夹，查找第一季的其他命名
    const items = fs.readdirSync(tvShowPath, { withFileTypes: true });
    const seasonFolders = items.filter(item => 
      item.isDirectory() && 
      (item.name.toLowerCase().includes('season') || 
       item.name.toLowerCase().includes('s01') ||
       item.name.toLowerCase().includes('第一季') ||
       /^season\s*1$/i.test(item.name) ||
       /^s1$/i.test(item.name))
    );
    
    if (seasonFolders.length > 0) {
      // 按文件夹名称排序，取第一个
      seasonFolders.sort((a, b) => a.name.localeCompare(b.name));
      const firstSeasonPath = path.join(tvShowPath, seasonFolders[0].name);
      return findFirstVideoFile(firstSeasonPath, videoExtensions);
    }
    
    // 如果没有季文件夹，直接在电视剧根目录查找
    return findFirstVideoFile(tvShowPath, videoExtensions);
  } catch (error) {
    console.error(`查找第一集出错: ${tvShowPath}`, error);
    return null;
  }
}

// 在文件夹中查找第一个视频文件
function findFirstVideoFile(folderPath, extensions) {
  try {
    const items = fs.readdirSync(folderPath, { withFileTypes: true });
    
    // 过滤出视频文件并按名称排序
    const videoFiles = items
      .filter(item => item.isFile() && 
        extensions.some(ext => item.name.toLowerCase().endsWith(ext)))
      .map(item => item.name)
      .sort((a, b) => a.localeCompare(b));
    
    if (videoFiles.length > 0) {
      return path.join(folderPath, videoFiles[0]);
    }
    
    return null;
  } catch (error) {
    console.error(`查找视频文件出错: ${folderPath}`, error);
    return null;
  }
}

// 当Electron完成初始化并准备创建浏览器窗口时调用此方法
app.whenReady().then(() => {
  createWindow();

  // 窗口控制IPC监听器
  ipcMain.on('window-control', (event, action) => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
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

  app.on('activate', function () {
    // 在macOS上，当单击dock图标并且没有其他窗口打开时，
    // 通常在应用程序中重新创建一个窗口。
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 当所有窗口关闭时退出应用
app.on('window-all-closed', function () {
  // 在macOS上，除非用户用Cmd+Q确定地退出，
  // 否则绝大部分应用及其菜单栏会保持激活。
  // 在Windows上，所有窗口关闭时也退出应用
  if (process.platform !== 'darwin') {
    stopMemoryMonitoring();
    app.quit();
  }
});

// 应用退出前清理
app.on('before-quit', () => {
  console.log('应用即将退出，清理资源...');
  stopMemoryMonitoring();
});









app.on('activate', function () {
  // 在macOS上，当单击dock图标并且没有其他窗口打开时，
  // 通常在应用程序中重新创建一个窗口。
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});