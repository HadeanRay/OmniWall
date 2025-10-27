const { app } = require('electron');
const AppManager = require('./app-manager');

// 创建应用管理器实例
const appManager = new AppManager();

// 应用启动
app.whenReady().then(() => {
  console.log('OmniWall 应用启动中...');
});

// 导出模块（用于测试和其他用途）
module.exports = { AppManager };