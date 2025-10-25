# OmniWall - 项目说明文档

## 项目概述

OmniWall 是一个基于 Electron 的现代化桌面应用，专门用于管理和播放本地电视剧库。它提供了一个美观的海报墙界面来浏览电视剧，并内置了功能完善的播放器。

## 项目架构

- **技术栈**: Electron + Node.js + HTML/CSS/JavaScript
- **架构模式**: 模块化设计，采用 MVC 架构模式
- **主进程**: `main.js` - 应用入口，协调各模块
- **核心模块**:
  - `app-manager.js` - 应用管理器，协调所有模块
  - `config-manager.js` - 配置管理，处理设置文件读写
  - `window-manager.js` - 窗口管理，创建和管理各种窗口
  - `tv-show-scanner.js` - 电视剧扫描器，处理文件系统扫描
  - `subtitle-manager.js` - 字幕管理器，处理字幕提取和检测
- **渲染进程**: 
  - `index.html` - 主界面，显示电视剧海报墙
  - `settings.html` - 设置页面，配置电视剧文件夹路径
  - `player.html` - 视频播放器界面
- **前端组件**:
  - `app.js` - 应用主控制器
  - `state-manager.js` - 状态管理
  - `poster-grid.js` - 海报网格渲染
  - `sidebar.js` - 侧边栏管理
  - `window-controls.js` - 窗口控制
- **数据存储**: 使用 `electron-store` 存储用户设置，支持播放进度和字幕设置

## 核心功能

### 1. 电视剧管理
- 自动扫描指定文件夹中的电视剧
- 智能识别季和集的组织结构
- 支持多种视频格式 (mp4, mkv, avi, mov, wmv, flv, webm)
- 自动查找海报图片 (poster.jpg, poster.png, -thumb.jpg)
- 支持 .nfo 文件解析，准确提取剧集信息

### 2. 播放器功能
- **播放器组件**: HTML5 原生 `<video>` 元素 + 自定义控件
- 视频播放控制（播放/暂停、快进/快退、音量控制）
- 季和集导航（竖向滚动布局，显示集号和标题）
- 全屏播放（隐藏侧边栏，显示浮动控制条）
- 键盘快捷键支持
- 自动播放下集
- 外部字幕文件支持 (SRT, VTT, ASS, SSA, SUB)
- 内嵌字幕轨道检测

### 3. 界面特性
- 现代化的暗色主题设计
- 无边框窗口设计，自定义窗口控制按钮
- 响应式布局，支持窗口和全屏模式
- 海报卡片展示
- 自定义浮动控制条（隐藏默认播放器控件）

## 项目结构

```
OmniWall/
├── main.js                    # Electron 主进程（重构后的入口）
├── index.html                 # 主界面 - 海报墙
├── player.html               # 播放器界面（包含完整CSS和JavaScript）
├── settings.html             # 设置页面
├── package.json              # 项目配置和依赖
├── package-lock.json         # 依赖锁定文件
├── README.md                 # 项目说明
├── IFLOW.md                  # 项目开发文档（本文档）
├── 重构说明.md               # 重构详细说明
├── 字幕功能说明.md           # 字幕功能详细说明
├── app/
│   └── app-manager.js        # 应用管理器
├── config/
│   └── config-manager.js     # 配置管理器
├── js/
│   ├── app.js                # 前端应用控制器
│   ├── poster-grid.js        # 海报网格组件
│   ├── sidebar.js            # 侧边栏组件
│   ├── state-manager.js      # 状态管理器
│   └── window-controls.js    # 窗口控制组件
├── services/
│   ├── subtitle-manager.js   # 字幕管理器
│   ├── tv-show-scanner.js    # 电视剧扫描器
│   └── window-manager.js     # 窗口管理器
└── node_modules/             # 依赖包
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
启用 Node.js 调试器在端口 5858

### 远程调试模式
```bash
npm run debug
```
启用远程调试在端口 9222，可通过浏览器访问 `chrome://inspect` 调试渲染进程

## 依赖项

### 生产依赖
- `electron-store`: ^11.0.2 - 本地配置存储
- `electron`: ^38.3.0 - Electron 框架
- `ffmpeg-static`: ^5.2.0 - FFmpeg 静态二进制文件
- `@ffmpeg-installer/ffmpeg`: ^1.1.0 - FFmpeg 安装器
- `@ffprobe-installer/ffprobe`: ^2.1.2 - FFprobe 安装器
- `fluent-ffmpeg`: ^2.1.3 - FFmpeg Node.js 接口
- `node-ffprobe`: ^3.0.0 - FFprobe Node.js 接口
- `video.js`: ^8.15.0 - 视频播放器框架（保留为备选）
- `@videojs/http-streaming`: ^3.15.0 - HLS流媒体支持（保留为备选）

## 文件组织结构约定

### 电视剧文件夹结构
应用期望的电视剧文件夹结构：
```
电视剧根目录/
├── 电视剧名称1/
│   ├── poster.jpg      # 海报图片
│   ├── Season 1/       # 第一季
│   │   ├── S01E01.mp4
│   │   ├── S01E01.nfo  # 剧集元数据文件（可选）
│   │   ├── S01E02.mp4
│   │   └── ...
│   ├── Season 2/       # 第二季
│   └── ...
├── 电视剧名称2/
└── ...
```

### 支持的视频格式
- .mp4, .mkv, .avi, .mov, .wmv, .flv, .webm

### 支持的字幕格式
- .srt, .vtt, .ass, .ssa, .sub

### 海报图片命名
- `poster.jpg` 或 `poster.png` (优先)
- `-thumb.jpg` (备选)

## 开发说明

### 进程间通信 (IPC)
主进程和渲染进程通过 IPC 进行通信，由 AppManager 统一处理：
- `open-settings`: 打开设置窗口
- `open-folder-dialog`: 打开文件夹选择对话框
- `save-settings`: 保存设置到本地存储
- `load-settings`: 加载设置
- `scan-tv-shows`: 扫描电视剧
- `play-tv-show`: 播放电视剧
- `get-seasons`: 获取季列表
- `get-season-episodes`: 获取指定季的集数
- `check-external-subtitles`: 检查外部字幕文件
- `check-embedded-subtitles`: 检查内嵌字幕轨道
- `extract-embedded-subtitle`: 提取内嵌字幕
- `window-control`: 窗口控制（最小化、最大化、关闭）
- `get-memory-usage`: 获取内存使用情况

### 文件扫描逻辑
- 自动检测季文件夹（支持 "Season X", "SX", "第X季" 等格式）
- 从 .nfo 文件名中优先提取集号进行排序
- 支持多种集号格式匹配（S01E01, [01], 第01集 等）
- 智能查找第一季第一集作为预览
- 支持嵌套文件夹结构

### 播放器特性
#### 自定义控件
- 完全隐藏 HTML5 原生播放器控件
- 使用自定义浮动控制条
- 窗口和全屏模式下统一的控件体验

#### 季集导航
- 季按钮：横向网格布局，显示季号
- 集按钮：竖向滚动布局，显示"第X集"和完整标题
- 自动滚动支持，集数较多时可滚动查看

#### 键盘快捷键
- 空格键：播放/暂停
- 左右箭头：快退/快进
- Ctrl+左右箭头：上一集/下一集
- F/Ctrl+F：全屏切换
- M：静音切换
- 上下箭头：音量调节
- Ctrl+S：字幕菜单切换

#### 字幕支持
- **内嵌字幕**: 自动检测视频文件中的内嵌字幕轨道
- **外挂字幕**: 自动扫描视频文件同目录下的外挂字幕文件
- **字幕提取**: 使用 FFmpeg 提取内嵌字幕为 VTT 格式
- **智能缓存**: 提取的字幕文件会被缓存，避免重复提取
- **字幕菜单**: 支持播放过程中动态切换不同字幕轨道
- **格式支持**: SRT、VTT、ASS、SSA、SUB 等多种格式
- **实时切换**: 支持播放过程中切换不同字幕轨道

## 调试功能

### 开发工具
- 默认开启开发者工具
- 详细的控制台日志输出
- 支持 Node.js 和 Chrome DevTools 调试
- 内存使用监控和垃圾回收
- 模块化架构便于单元测试

### 调试文档
- `重构说明.md` - 详细的重构过程说明
- `字幕功能说明.md` - 完整的字幕功能技术文档

## 设置存储

### 配置文件位置
用户设置存储在 `~/.omniwall/` 目录下 (Windows: `C:\Users\用户名\.omniwall\`):
- `settings.json` - 应用设置
- `playback-progress.json` - 播放进度记录
- `last-played.json` - 最后播放记录
- `subtitle-settings.json` - 字幕设置

### 配置管理
- 自动创建配置目录
- 统一的配置读写接口
- 错误处理和默认值设置

## 使用流程

1. 启动应用后，点击设置按钮配置电视剧文件夹路径
2. 应用自动扫描并显示电视剧海报墙
3. 点击海报开始播放第一季第一集
4. 在播放器中可选择不同季和集
5. 使用播放器控制条或键盘快捷键控制播放
6. 全屏播放时侧边栏自动隐藏
7. 支持字幕切换和音量调节

## 技术实现细节

### 模块化架构设计
- **AppManager**: 应用总控制器，协调所有模块，处理 IPC 事件
- **ConfigManager**: 配置管理，统一处理所有配置文件读写
- **WindowManager**: 窗口管理，负责窗口创建、生命周期和事件处理
- **TvShowScanner**: 电视剧扫描器，智能识别季集结构和文件组织
- **SubtitleManager**: 字幕管理器，支持内嵌和外挂字幕处理
- **前端组件**: 模块化前端架构，职责分离，便于维护

### 播放器架构
- 使用 HTML5 原生 `<video>` 元素，避免第三方库依赖
- 通过 CSS 完全隐藏默认控件：`controlslist="nodownload noplaybackrate nofullscreen"`
- 自定义浮动控制条使用 Flexbox 布局
- 响应式设计，适配不同窗口尺寸

### 字幕系统
- **FFmpeg 集成**: 使用 ffmpeg-static 和 fluent-ffmpeg 进行字幕提取
- **内嵌字幕检测**: 通过 FFprobe 分析视频文件字幕轨道
- **外挂字幕扫描**: 自动识别同目录下的字幕文件
- **字幕缓存**: 智能缓存提取的字幕文件，提高性能
- **多格式支持**: SRT、VTT、ASS、SSA、SUB 等格式

### 季集数据管理
- 基于文件系统扫描的智能季集识别
- 支持多种命名约定和文件结构
- 实时数据更新，无需重启应用
- 错误处理和容错机制

### 性能优化
- 内存使用监控和自动清理
- 视频资源管理，避免内存泄漏
- 异步文件扫描，不阻塞UI线程
- 滚动虚拟化（集按钮区域）

## 模块职责说明

### AppManager
- 应用生命周期管理
- IPC 事件处理和分发
- 内存使用监控
- 模块协调和初始化

### ConfigManager
- 配置文件路径管理
- 设置读写和持久化
- 播放进度记录
- 字幕设置管理

### WindowManager
- 窗口创建和管理
- 对话框处理
- 窗口状态维护
- 窗口事件监听

### TvShowScanner
- 电视剧文件夹扫描
- 季和集的组织识别
- 海报和剧集查找
- 外部字幕文件检测

### SubtitleManager
- 内嵌字幕轨道检测
- 字幕提取和缓存管理
- 字幕格式转换
- 外挂字幕扫描

## 注意事项

- 确保电视剧文件夹结构符合预期格式
- 视频文件命名应包含集号以便正确排序
- 应用首次运行时需要设置电视剧文件夹路径
- 支持跨平台运行（Windows、macOS、Linux）
- 视频播放性能受本地硬件和文件格式影响
- 字幕文件需与视频文件同名并位于同一目录
- FFmpeg 依赖需要正确安装才能使用字幕提取功能

## 版本历史

### 最新更新
- **模块化重构**: 将单体架构重构为模块化设计，提高可维护性
- **完整字幕支持**: 集成 FFmpeg 支持内嵌字幕提取和外挂字幕管理
- **播放器改进**: 使用 HTML5 原生 `<video>` 元素，完全自定义控件
- **季集导航**: 竖向滚动布局，优化用户体验
- **配置管理**: 统一的配置系统，支持播放进度和字幕设置
- **性能优化**: 内存监控和资源管理优化

### 架构变更
- **AppManager**: 新的应用协调器，统一 IPC 事件处理
- **ConfigManager**: 集中配置管理，自动创建配置目录
- **WindowManager**: 独立的窗口管理模块
- **TvShowScanner**: 专业的电视剧扫描模块
- **SubtitleManager**: 完整的字幕处理模块
- **前端组件化**: 分离状态管理、UI 组件和业务逻辑

### 技术改进
- 修复 Video.js API 残留问题
- 改进季集数据读取逻辑
- 增强错误处理和用户反馈
- 优化界面布局和用户体验
- 添加详细的开发文档和重构说明