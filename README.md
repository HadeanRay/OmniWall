<<<<<<< HEAD
# OmniWall
基于electron的电影墙播放器。自动识别由TMM刮削整理的电影电视剧，以电影墙形式呈现，带有播放功能。
=======
# OmniWall - Electron 桌面应用

这是一个现代化的 Electron 桌面应用模板，已配置好调试功能。

## 项目结构

```
OmniWall/
├── main.js          # Electron 主进程文件
├── index.html       # 渲染进程界面
├── package.json     # 项目配置和依赖
└── README.md        # 项目说明
```

## 运行命令

### 正常启动
```bash
npm start
```

### 调试模式（Node.js 调试器）
```bash
npm run dev
```
这个命令会启用 Node.js 调试器在端口 5858，可以通过 VS Code 或其他调试器连接进行调试。

### 远程调试模式
```bash
npm run debug
```
这个命令会启用远程调试在端口 9222，可以通过浏览器访问 `chrome://inspect` 来调试渲染进程。

## 调试功能

应用已配置以下调试功能：

1. **自动打开开发者工具** - 启动时自动打开 Chrome 开发者工具
2. **控制台日志** - 点击"测试控制台输出"按钮查看控制台日志
3. **环境信息显示** - 显示 Node.js、Chrome 和 Electron 版本信息
4. **实时时间更新** - 显示当前系统时间

## 主要特性

- 现代化的渐变背景设计
- 响应式布局
- 开发者工具集成
- 调试信息面板
- 测试按钮用于验证功能

## 开发说明

- 主进程代码在 `main.js` 中
- 渲染进程界面在 `index.html` 中
- 开发者工具已默认开启，方便调试
- 可以通过 `mainWindow.webContents.openDevTools()` 控制开发者工具的显示
>>>>>>> 05ae804 (Base)
