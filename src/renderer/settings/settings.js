const { ipcRenderer } = require('electron');

// 窗口控制功能
function minimizeWindow() {
    ipcRenderer.send('window-control', 'minimize');
}

function toggleMaximizeWindow() {
    ipcRenderer.send('window-control', 'toggle-maximize');
}

// 更新最大化按钮状态
function updateMaximizeButton(isMaximized) {
    const maximizeBtn = document.querySelector('.maximize-btn');
    if (maximizeBtn) {
        maximizeBtn.classList.toggle('maximized', isMaximized);
    }
}

// 监听窗口状态变化
ipcRenderer.on('window-state-changed', (event, state) => {
    if (state.isMaximized !== undefined) {
        updateMaximizeButton(state.isMaximized);
    }
});

function closeSettings() {
    console.log('设置窗口已关闭');
    window.close();
}

// 选择文件夹
function selectFolder() {
    ipcRenderer.send('open-folder-dialog');
}

// 选择ffmpeg可执行文件
function selectFfmpeg() {
    ipcRenderer.send('open-file-dialog', { 
        filters: [
            { name: 'Executable Files', extensions: ['exe'] },
            { name: 'All Files', extensions: ['*'] }
        ],
        title: '选择ffmpeg可执行文件'
    });
}

// 监听文件夹选择结果
ipcRenderer.on('selected-folder', (event, folderPath) => {
    if (folderPath) {
        document.getElementById('filePathInput').value = folderPath;
        document.getElementById('pathInfo').textContent = `已选择文件夹: ${folderPath}`;
        console.log('选择的文件夹路径:', folderPath);
        
        // 立即保存设置，确保路径信息被记住
        const settings = {
            filePath: folderPath,
            lastSaved: new Date().toLocaleString('zh-CN')
        };
        ipcRenderer.send('save-settings', settings);
        console.log('自动保存文件夹路径设置');
    }
});

// 监听文件选择结果
ipcRenderer.on('selected-file', (event, filePath) => {
    if (filePath) {
        document.getElementById('ffmpegPathInput').value = filePath;
        console.log('选择的ffmpeg路径:', filePath);
    }
});

// 监听设置加载完成
ipcRenderer.on('settings-loaded', (event, settings) => {
    if (settings.filePath) {
        document.getElementById('filePathInput').value = settings.filePath;
        document.getElementById('pathInfo').textContent = `已选择文件夹: ${settings.filePath}`;
        console.log('已恢复保存的路径:', settings.filePath);
    }
    if (settings.ffmpegPath) {
        document.getElementById('ffmpegPathInput').value = settings.ffmpegPath;
        console.log('已恢复保存的FFMPEG路径:', settings.ffmpegPath);
    }
    if (settings.bangumiToken) {
        document.getElementById('bangumiTokenInput').value = settings.bangumiToken;
        console.log('已恢复保存的Bangumi Token');
    }
});

function saveSettings() {
    const filePath = document.getElementById('filePathInput').value;
    const ffmpegPath = document.getElementById('ffmpegPathInput').value;
    const bangumiToken = document.getElementById('bangumiTokenInput').value;
    
    if (filePath) {
        console.log('保存的文件路径:', filePath);
        console.log('保存的FFMPEG路径:', ffmpegPath);
        console.log('保存的Bangumi Token:', bangumiToken ? '[已设置]' : '[未设置]');
        // 保存设置到本地存储
        const settings = {
            filePath: filePath,
            ffmpegPath: ffmpegPath,
            bangumiToken: bangumiToken || null, // 如果为空则存储为null
            lastSaved: new Date().toLocaleString('zh-CN')
        };
        ipcRenderer.send('save-settings', settings);
        
        // 通知主窗口刷新电视剧列表
        ipcRenderer.send('refresh-tv-shows');
        
        alert(`设置保存成功！\n文件路径: ${filePath}\nFFMPEG路径: ${ffmpegPath || '未设置'}\nBangumi Token: ${bangumiToken ? '已设置' : '未设置'}`);
    } else {
        alert('请先选择文件夹！');
        return;
    }
    window.close(); // 关闭设置窗口
}

// 字幕提取功能
function extractSubtitles() {
    const filePath = document.getElementById('filePathInput').value;
    if (!filePath) {
        alert('请先选择文件夹路径！');
        return;
    }
    
    const ffmpegPath = document.getElementById('ffmpegPathInput').value;
    
    const btn = document.getElementById('extractBtn');
    const status = document.getElementById('extractStatus');
    const progress = document.getElementById('extractProgress');
    
    btn.disabled = true;
    btn.textContent = '正在提取...';
    status.textContent = '开始扫描视频文件...';
    progress.style.display = 'block';
    
    // 发送字幕提取请求
    ipcRenderer.send('extract-subtitles', { 
        folderPath: filePath,
        ffmpegPath: ffmpegPath || null
    });
}

// 清除字幕缓存
function clearSubtitleCache() {
    if (confirm('确定要清除字幕缓存吗？这将导致下次提取时需要重新检测所有视频的字幕流。')) {
        const status = document.getElementById('extractStatus');
        status.textContent = '正在清除缓存...';
        
        ipcRenderer.send('clear-subtitle-cache');
    }
}

// 监听字幕提取进度
ipcRenderer.on('subtitle-extract-progress', (event, data) => {
    const status = document.getElementById('extractStatus');
    const progressText = document.getElementById('progressText');
    const progressBar = document.getElementById('progressBar');
    
    if (data.status === 'scanning') {
        status.textContent = `扫描到 ${data.total} 个视频文件`;
    } else if (data.status === 'processing') {
        const percent = (data.current / data.total) * 100;
        progressText.textContent = `${data.current}/${data.total}`;
        progressBar.style.width = `${percent}%`;
        status.textContent = `正在处理: ${data.currentFile}`;
    } else if (data.status === 'completed') {
        status.textContent = `字幕提取完成！共处理 ${data.processed} 个文件，成功 ${data.success} 个`;
        const btn = document.getElementById('extractBtn');
        btn.disabled = false;
        btn.textContent = '提取字幕';
    } else if (data.status === 'error') {
        status.textContent = `错误: ${data.message}`;
        const btn = document.getElementById('extractBtn');
        btn.disabled = false;
        btn.textContent = '提取字幕';
    }
});

// 监听字幕缓存清除完成
ipcRenderer.on('subtitle-cache-cleared', (event, data) => {
    const status = document.getElementById('extractStatus');
    if (data.status === 'success') {
        status.textContent = data.message;
        setTimeout(() => {
            status.textContent = '缓存已清除';
        }, 3000);
    }
});

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('设置页面已加载');
    // 加载保存的设置
    ipcRenderer.send('load-settings');
    
    setTimeout(() => {
        const filePath = document.getElementById('filePathInput').value;
        
        if (filePath) {
            document.getElementById('pathInfo').textContent = `已选择文件夹: ${filePath}`;
        } else {
            document.getElementById('pathInfo').textContent = '当前未选择文件夹';
        }
    }, 100);
});