# OmniWall - 项目说明文档

## 项目概述

OmniWall 是一个基于 Electron 的现代化桌面应用，专门用于管理和播放本地电视剧库。它提供了一个美观的海报墙界面来浏览电视剧，并内置了功能完善的播放器。

## 项目架构

- **技术栈**: Electron + Node.js + HTML/CSS/JavaScript
- **主进程**: `main.js` - 负责应用窗口管理、文件系统操作、进程间通信
- **渲染进程**: 
  - `index.html` - 主界面，显示电视剧海报墙
  - `settings.html` - 设置页面，配置电视剧文件夹路径
  - `player.html` - 视频播放器界面
- **数据存储**: 使用 `electron-store` 存储用户设置

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
├── main.js                    # Electron 主进程
├── index.html                 # 主界面 - 海报墙
├── player.html               # 播放器界面（包含完整CSS和JavaScript）
├── settings.html             # 设置页面
├── package.json              # 项目配置和依赖
├── package-lock.json         # 依赖锁定文件
├── README.md                 # 项目说明
├── IFLOW.md                  # 项目开发文档（本文档）
├── OmniWall.png              # 应用图标
├── player.png                # 播放器界面截图
├── drag.css                  # 拖拽样式文件
├── debug_seasons.js          # 季扫描调试脚本
├── debug_episodes.js         # 集扫描调试脚本
├── debug_nfo_parsing.js      # NFO文件解析调试
├── debug_file_matching.js    # 文件匹配调试
├── debug_scan_episodes.js    # 剧集扫描调试
├── check_files.js            # 文件检查脚本
├── check_season_files.js     # 季文件检查脚本
├── test_fix.js               # 测试修复脚本
├── test_nfo_parsing.js       # NFO解析测试
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
- `video.js`: ^8.15.0 - 视频播放器框架（当前未使用，保留为备选）
- `@videojs/http-streaming`: ^3.15.0 - HLS流媒体支持（当前未使用）

### 开发依赖
- `electron`: ^38.3.0 - Electron 框架

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
主进程和渲染进程通过 IPC 进行通信：
- `open-settings`: 打开设置窗口
- `open-folder-dialog`: 打开文件夹选择对话框
- `save-settings`: 保存设置到本地存储
- `load-settings`: 加载设置
- `scan-tv-shows`: 扫描电视剧
- `play-tv-show`: 播放电视剧
- `get-seasons`: 获取季列表
- `get-season-episodes`: 获取指定季的集数
- `check-external-subtitles`: 检查外部字幕文件
- `window-control`: 窗口控制（最小化、最大化、关闭）

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
- 自动检测内嵌字幕轨道
- 支持外部字幕文件加载
- 字幕语言自动识别（中文、英文、日文等）
- 字幕菜单支持动态切换

## 调试功能

### 调试脚本
项目包含多个调试脚本用于测试核心功能：
- `debug_seasons.js` - 季扫描逻辑测试
- `debug_episodes.js` - 集扫描逻辑测试
- `debug_nfo_parsing.js` - NFO文件解析测试
- `debug_file_matching.js` - 文件匹配测试
- `debug_scan_episodes.js` - 剧集扫描测试

### 开发工具
- 默认开启开发者工具
- 详细的控制台日志输出
- 支持 Node.js 和 Chrome DevTools 调试
- 内存使用监控和垃圾回收

## 设置存储

用户设置存储在：
`~/.omniwall/settings.json` (Windows: `C:\Users\用户名\.omniwall\settings.json`)

## 使用流程

1. 启动应用后，点击设置按钮配置电视剧文件夹路径
2. 应用自动扫描并显示电视剧海报墙
3. 点击海报开始播放第一季第一集
4. 在播放器中可选择不同季和集
5. 使用播放器控制条或键盘快捷键控制播放
6. 全屏播放时侧边栏自动隐藏
7. 支持字幕切换和音量调节

## 技术实现细节

### 播放器架构
- 使用 HTML5 原生 `<video>` 元素，避免第三方库依赖
- 通过 CSS 完全隐藏默认控件：`controlslist="nodownload noplaybackrate nofullscreen"`
- 自定义浮动控制条使用 Flexbox 布局
- 响应式设计，适配不同窗口尺寸

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

## 注意事项

- 确保电视剧文件夹结构符合预期格式
- 视频文件命名应包含集号以便正确排序
- 应用首次运行时需要设置电视剧文件夹路径
- 支持跨平台运行（Windows、macOS、Linux）
- 视频播放性能受本地硬件和文件格式影响
- 字幕文件需与视频文件同名并位于同一目录

## 版本历史

### 最新更新
- 播放器改用 HTML5 原生 `<video>` 元素
- 完全自定义控件，隐藏默认播放器界面
- 季集导航改为竖向滚动布局
- 支持外部字幕文件和内嵌字幕轨道
- 添加多个调试脚本用于功能测试
- 优化内存管理和性能监控

### 技术改进
- 修复 Video.js API 残留问题
- 改进季集数据读取逻辑
- 增强错误处理和用户反馈
- 优化界面布局和用户体验