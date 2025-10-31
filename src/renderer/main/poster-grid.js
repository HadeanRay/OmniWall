(function() {
    
class PosterGrid {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.tvShows = [];
        this.optimalRows = 2; // 默认2行
        this.scrollAnimationId = null;
        
        // 无限滑动相关属性
        this.if_movable = false;
        this.mouse_x = 0;
        this.mouse_y = 0;
        this.container_width = 0;
        this.container_height = 0;
        this.poster_width = 0;
        this.poster_height = 0;
        this.scale_nums = 1;
        this.standard_width = 1440;
        this.img_data = []; // 存储每个海报的位置数据
        this.gsap = null; // GSAP动画库
        
        this.init();
    }

    init() {
        if (!this.container) {
            console.error('海报网格容器未找到:', this.containerId);
            return;
        }
        
        // 加载GSAP库
        this.loadGSAP().then(() => {
            this.setupEventListeners();
            this.setupResizeListener();
            this.setupInfiniteScrollListeners(); // 替换滚轮事件为无限滑动
            this.updatePosterSize(); // 初始化尺寸
        }).catch(error => {
            console.error('加载GSAP失败，使用默认滚动:', error);
            this.setupEventListeners();
            this.setupResizeListener();
            this.setupWheelListener(); // 回退到原始滚轮事件
            this.updatePosterSize(); // 初始化尺寸
        });
    }

    setupEventListeners() {
        // 监听电视剧扫描结果
        const { ipcRenderer } = require('electron');
        ipcRenderer.on('tv-shows-scanned', (event, data) => {
            this.handleTvShowsScanned(data);
        });
    }

    setupResizeListener() {
        // 监听窗口大小变化，调整海报尺寸
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.updatePosterSize();
                // 如果已经有渲染的网格，重新渲染以更新布局
                if (this.tvShows.length > 0) {
                    this.renderGrid();
                }
            }, 100);
        });
    }

    async loadGSAP() {
        return new Promise((resolve, reject) => {
            if (window.gsap) {
                this.gsap = window.gsap;
                resolve();
                return;
            }
            
            // 动态加载GSAP
            const script = document.createElement('script');
            script.src = '../../../node_modules/gsap/dist/gsap.min.js';
            script.onload = () => {
                this.gsap = window.gsap;
                resolve();
            };
            script.onerror = () => reject(new Error('GSAP加载失败'));
            document.head.appendChild(script);
        });
    }

    setupWheelListener() {
        // 监听鼠标滚轮事件，实现平滑横向滚动
        this.container.addEventListener('wheel', (event) => {
            // 防止默认的垂直滚动行为
            event.preventDefault();
            
            // 获取滚动容器
            const scrollContainer = this.container.parentElement;
            if (!scrollContainer) return;
            
            // 简化滚动逻辑，直接使用deltaY值进行滚动
            const scrollAmount = event.deltaY * 1.5; // 稍微增加滚动灵敏度
            
            // 平滑滚动实现
            this.smoothScroll(scrollContainer, scrollAmount);
            
        }, { passive: false }); // 必须设置为非被动事件，才能调用 preventDefault()
    }

    setupInfiniteScrollListeners() {
        if (!this.gsap) {
            console.warn('GSAP未加载，使用默认滚轮事件');
            this.setupWheelListener();
            return;
        }
        
        console.log('设置无限滑动事件监听器（鼠标滚轮模式）');
        
        // 鼠标滚轮事件 - 无限横向滚动
        this.container.addEventListener('wheel', (event) => {
            event.preventDefault(); // 阻止默认滚动行为
            
            // 将滚轮的deltaY转换为横向移动距离 - 降低灵敏度
            const scrollDistance = event.deltaY * 0.8; // 降低滚动灵敏度，使滚动更慢
            
            // 处理无限横向滚动
            this.handleInfiniteWheelScroll(scrollDistance);
        }, { passive: false });
        
        // 触摸设备支持（保持拖拽模式，因为触摸更适合拖拽）
        this.container.addEventListener('touchstart', (event) => {
            this.if_movable = true;
            this.mouse_x = event.touches[0].clientX;
            this.mouse_y = event.touches[0].clientY;
            event.preventDefault();
        });
        
        this.container.addEventListener('touchend', () => {
            this.if_movable = false;
        });
        
        this.container.addEventListener('touchmove', (event) => {
            if (this.if_movable) {
                this.handleInfiniteScroll(event.touches[0].clientX, event.touches[0].clientY);
                event.preventDefault();
            }
        });
    }

    handleInfiniteScroll(clientX, clientY) {
        if (!this.if_movable || !this.gsap) return;
        
        const distance_x = (clientX - this.mouse_x) / this.scale_nums;
        // 只处理横向移动，忽略纵向移动
        const distance_y = 0;
        
        // 计算实际的横向循环距离 - 基于卡片列数和间距
        const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--poster-gap')) || 12;
        const maxRows = this.optimalRows || 2;
        const totalCols = Math.ceil(this.img_data.length / maxRows); // 总列数
        const cycleDistance = totalCols * (this.poster_width + gap); // 一列完整循环的距离
        
        this.img_data.forEach((img) => {
            let duration = 0.8; // 默认动画时长
            img.mov_x += distance_x;
            // 纵向位置保持不变
            // img.mov_y += distance_y; // 禁用纵向移动
            
            // 获取当前总位置
            const total_x = img.x + img.mov_x;
            const total_y = img.y + img.mov_y;
            
            // 水平边界循环检测 - 基于实际的列宽总距离
            if (total_x > cycleDistance + this.poster_width) {
                img.mov_x -= (cycleDistance);
                duration = 0; // 瞬间移动
            }
            if (total_x < -this.poster_width * 2) {
                img.mov_x += (cycleDistance );
                duration = 0;
            }
            
            // 禁用垂直边界循环检测
            // 保持纵向位置固定，不允许循环
            
            // 停止之前的动画
            if (img.ani) img.ani.kill();
            
            // 计算新的目标位置 - 只横向移动
            const target_x = img.x + img.mov_x;
            const target_y = img.y; // 保持原始纵向位置
            
            // 应用新动画 - 只横向移动
            img.ani = this.gsap.to(img.node, {
                x: target_x,
                y: target_y, // 保持纵向位置不变
                duration: duration,
                ease: 'power4.out'
            });
        });
        
        this.mouse_x = clientX;
        this.mouse_y = clientY;
    }

    handleInfiniteWheelScroll(scrollDistance) {
        if (!this.gsap) return;
        
        // 使用滚轮距离作为横向移动距离 - 进一步降低移动距离
        const distance_x = scrollDistance * 0.6 / this.scale_nums; // 降低移动距离，使滚动更慢更平滑
        
        // 使用body窗口的实时宽度作为循环距离
        const bodyWidth = document.body.clientWidth;
        // 计算实际的横向循环距离 - 基于卡片列数和间距
        const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--poster-gap')) || 12;
        const maxRows = this.optimalRows || 2;
        const totalCols = Math.ceil(this.img_data.length / maxRows); // 总列数
        const cycleDistance = totalCols * (this.poster_width + gap); // 一列完整循环的距离
        
        // 调试信息
        console.log(`无限滑动调试: 总卡片数=${this.img_data.length}, 循环距离=${cycleDistance}px, 卡片宽度=${this.poster_width}px, body宽度=${bodyWidth}px`);
        
        this.img_data.forEach((img) => {
            let duration = 0.8; // 增加动画时长，让滚动更平滑
            img.mov_x += distance_x;
            
            // 获取当前总位置
            const total_x = img.x + img.mov_x;
            
            // 水平边界循环检测 - 修复循环逻辑，确保两个区域无缝连接
            // 右侧边界：当卡片移动到cycleDistance时，向左移动cycleDistance距离
            if (total_x > bodyWidth + this.poster_width) {
                img.mov_x -= cycleDistance ;
                duration = 0; // 瞬间移动
                console.log(`右侧循环: 卡片位置=${total_x}, 循环到=${img.x + img.mov_x}`);
            }
            // 左侧边界：当卡片移动到-poster_width时，向右移动cycleDistance距离
            if (total_x < -this.poster_width -  this.poster_width) {
                img.mov_x += cycleDistance ;
                duration = 0;
                console.log(`左侧循环: 卡片位置=${total_x}, 循环到=${img.x + img.mov_x}`);
            }
            
            // 停止之前的动画
            if (img.ani) img.ani.kill();
            
            // 计算新的目标位置 - 只横向移动
            const target_x = img.x + img.mov_x;
            const target_y = img.y; // 保持原始纵向位置
            
            // 应用新动画 - 使用更平滑的缓动函数
            img.ani = this.gsap.to(img.node, {
                x: target_x,
                y: target_y, // 保持纵向位置不变
                duration: duration,
                ease: 'power3.out' // 使用更平滑的缓动函数
            });
        });
    }

    smoothScroll(scrollContainer, deltaX) {
        // 如果已经有滚动动画在进行，先停止它
        if (this.scrollAnimationId) {
            cancelAnimationFrame(this.scrollAnimationId);
        }
        
        const startTime = performance.now();
        const startScrollLeft = scrollContainer.scrollLeft;
        
        // 计算目标滚动位置，确保在有效范围内
        const maxScrollLeft = scrollContainer.scrollWidth - scrollContainer.clientWidth;
        let targetScrollLeft = startScrollLeft + deltaX;
        
        // 确保目标位置在有效范围内
        targetScrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScrollLeft));
        
        // 如果目标位置与当前位置相同，直接返回
        if (targetScrollLeft === startScrollLeft) {
            this.scrollAnimationId = null;
            return;
        }
        
        // 缓动函数：easeOutCubic
        const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
        
        // 动画时长（毫秒）- 根据滚动距离调整
        const baseDuration = 200;
        const scrollDistance = Math.abs(deltaX);
        const duration = Math.min(baseDuration + scrollDistance * 0.05, 500); // 减少最大时长
        
        const animateScroll = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // 应用缓动函数
            const easedProgress = easeOutCubic(progress);
            
            // 计算当前滚动位置
            const currentScrollLeft = startScrollLeft + (targetScrollLeft - startScrollLeft) * easedProgress;
            
            // 应用滚动
            scrollContainer.scrollLeft = currentScrollLeft;
            
            // 如果动画未完成，继续下一帧
            if (progress < 1) {
                this.scrollAnimationId = requestAnimationFrame(animateScroll);
            } else {
                this.scrollAnimationId = null;
            }
        };
        
        // 启动动画
        this.scrollAnimationId = requestAnimationFrame(animateScroll);
    }

    smoothScroll(scrollContainer, deltaX) {
        // 如果已经有滚动动画在进行，先停止它
        if (this.scrollAnimationId) {
            cancelAnimationFrame(this.scrollAnimationId);
        }
        
        const startTime = performance.now();
        const startScrollLeft = scrollContainer.scrollLeft;
        
        // 计算目标滚动位置，确保在有效范围内
        const maxScrollLeft = scrollContainer.scrollWidth - scrollContainer.clientWidth;
        let targetScrollLeft = startScrollLeft + deltaX;
        
        // 确保目标位置在有效范围内
        targetScrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScrollLeft));
        
        // 如果目标位置与当前位置相同，直接返回
        if (targetScrollLeft === startScrollLeft) {
            this.scrollAnimationId = null;
            return;
        }
        
        // 缓动函数：easeOutCubic
        const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
        
        // 动画时长（毫秒）- 根据滚动距离调整
        const baseDuration = 200;
        const scrollDistance = Math.abs(deltaX);
        const duration = Math.min(baseDuration + scrollDistance * 0.05, 500); // 减少最大时长
        
        const animateScroll = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // 应用缓动函数
            const easedProgress = easeOutCubic(progress);
            
            // 计算当前滚动位置
            const currentScrollLeft = startScrollLeft + (targetScrollLeft - startScrollLeft) * easedProgress;
            
            // 应用滚动
            scrollContainer.scrollLeft = currentScrollLeft;
            
            // 如果动画未完成，继续下一帧
            if (progress < 1) {
                this.scrollAnimationId = requestAnimationFrame(animateScroll);
            } else {
                this.scrollAnimationId = null;
            }
        };
        
        // 启动动画
        this.scrollAnimationId = requestAnimationFrame(animateScroll);
    }

    // 移除惯性滚动功能，简化滚动逻辑

    updatePosterSize() {
        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth;
        
        // 获取main-content的实际尺寸
        const mainContent = this.container?.parentElement;
        if (!mainContent) return;
        
        const mainContentWidth = mainContent.clientWidth;
        const mainContentHeight = mainContent.clientHeight;
        
        // 基于main-content的实际高度计算最优行数
        const maxRows = 5;
        const minHeight = 240;
        const maxHeight = 600;
        const minGap = 12;
        
        // 计算每行最小需要的高度（海报高度 + 行间距）
        const rowGap = minGap;
        const minRowHeight = minHeight + rowGap;
        
        // 计算可用高度（基于main-content的实际高度）
        const availableHeight = mainContentHeight - 320; // 减去顶部padding
        
        // 计算最大行数
        const maxPossibleRows = Math.floor(availableHeight / (minHeight + rowGap));
        const optimalRows = Math.min(maxRows, Math.max(2, maxPossibleRows));
        
        // 根据可用高度和行数计算海报高度
        const totalRowGap = rowGap * (optimalRows - 1);
        const baseHeight = Math.max(minHeight, Math.min(maxHeight, (availableHeight - totalRowGap) / optimalRows));
        const baseWidth = baseHeight * 0.64; // 保持1:1.56的宽高比
        
        // 列间距只与海报宽度相关
        const maxGap = 20;
        const baseGap = Math.max(minGap, Math.min(maxGap, baseWidth * 0.2));
        
        // 设置CSS变量
        document.documentElement.style.setProperty('--poster-height', `${baseHeight}px`);
        document.documentElement.style.setProperty('--poster-width', `${baseWidth}px`);
        document.documentElement.style.setProperty('--poster-gap', `${baseGap}px`);
        document.documentElement.style.setProperty('--grid-rows', `${optimalRows}`);
        
        // 保存行数信息
        this.optimalRows = optimalRows;
        
        // 更新无限滑动相关尺寸
        if (this.container) {
            this.container_width = mainContentWidth;
            this.container_height = mainContentHeight;
            this.poster_width = baseWidth;
            this.poster_height = baseHeight;
            this.scale_nums = windowWidth / this.standard_width;
        }
        
        console.log(`main-content尺寸: ${mainContentWidth}x${mainContentHeight}, 最优行数: ${optimalRows}, 海报尺寸: ${Math.round(baseWidth)}x${Math.round(baseHeight)}, 间距: ${Math.round(baseGap)}px`);
        
        // 重新初始化位置以填满新尺寸
        if (this.img_data && this.img_data.length > 0) {
            this.initImagePositions();
        }
        
        // 更新调试信息
        this.updateDebugInfo();
    }

    updateDebugInfo() {
        const debugDiv = document.getElementById('grid-debug-info');
        if (debugDiv && this.container) {
            debugDiv.innerHTML = `
                <div>Grid Debug Info:</div>
                <div>总卡片数: ${this.tvShows.length}</div>
                <div>行数: ${this.optimalRows || 2}</div>
                <div>窗口尺寸: ${window.innerWidth}x${window.innerHeight}</div>
                <div>容器宽: ${this.container.clientWidth}px</div>
                <div>容器高: ${this.container.clientHeight}px</div>
                <div>海报宽: ${getComputedStyle(document.documentElement).getPropertyValue('--poster-width')}</div>
                <div>海报高: ${getComputedStyle(document.documentElement).getPropertyValue('--poster-height')}</div>
                <div>间距: ${getComputedStyle(document.documentElement).getPropertyValue('--poster-gap')}</div>
                <div>布局: 横向行、竖列排序</div>
                <div>CSS Grid: grid-auto-flow: row; grid-template-columns: repeat(auto-fill, var(--poster-width));</div>
            `;
        }
    }

    handleTvShowsScanned(data) {
        const loading = document.getElementById('loading');
        const error = document.getElementById('error');
        const empty = document.getElementById('empty');
        
        if (data.error) {
            this.showError(data.error);
            return;
        }
        
        this.tvShows = data.tvShows || [];
        
        if (this.tvShows.length === 0) {
            this.showEmptyState();
            return;
        }
        
        this.hideLoading();
        this.updatePosterSize(); // 确保渲染前尺寸正确
        this.renderGrid();
    }

    showError(message) {
        const loading = document.getElementById('loading');
        const error = document.getElementById('error');
        
        if (loading) loading.style.display = 'none';
        if (error) {
            error.style.display = 'block';
            error.textContent = message;
        }
    }

    showEmptyState() {
        const loading = document.getElementById('loading');
        const empty = document.getElementById('empty');
        
        if (loading) loading.style.display = 'none';
        if (empty) empty.style.display = 'block';
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) loading.style.display = 'none';
    }

    renderGrid() {
        this.container.style.display = 'grid';
        this.container.innerHTML = '';
        
        // 根据是否支持无限滑动添加相应的class
        if (this.gsap) {
            this.container.classList.add('infinite-scroll');
        }
        
        // 确保行数已计算，如果没有则使用默认2行
        const rows = this.optimalRows || 2;
        
        // 定义测试颜色数组
        const testColors = [
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7',
            '#dda0dd', '#98d8c8', '#f7dc6f', '#bb8fce', '#85c1e9',
            '#f8c471', '#82e0aa', '#f1948a', '#85c1e9', '#d7bde2',
            '#aed6f1', '#f9e79f', '#abebc6', '#fad7a0', '#e8daef'
        ];
        
        console.log(`渲染网格，总电视剧数: ${this.tvShows.length}, 行数: ${rows}`);
        console.log(`容器尺寸: ${this.container.clientWidth}x${this.container.clientHeight}`);
        console.log(`CSS变量: --poster-width: ${getComputedStyle(document.documentElement).getPropertyValue('--poster-width')}, --poster-height: ${getComputedStyle(document.documentElement).getPropertyValue('--poster-height')}, --poster-gap: ${getComputedStyle(document.documentElement).getPropertyValue('--poster-gap')}`);
        
        // 重置图片数据数组
        this.img_data = [];
        
        // 如果海报卡片数量小于20个，复制卡片直到超过20个
        let showsToRender = [...this.tvShows];
        const originalCount = this.tvShows.length;
        
        if (originalCount > 0 && originalCount < 20) {
            console.log(`原始卡片数量: ${originalCount}，开始复制卡片直到超过20个`);
            
            // 复制卡片直到总数超过20个
            while (showsToRender.length < 20) {
                // 按顺序复制原始卡片
                const copyIndex = showsToRender.length % originalCount;
                const tvShowToCopy = this.tvShows[copyIndex];
                
                // 创建完全相同的副本（包括所有属性）
                const copiedShow = {
                    ...tvShowToCopy,
                    // 确保复制后的是完全相同的对象，包括路径等信息
                    name: tvShowToCopy.name,
                    path: tvShowToCopy.path,
                    poster: tvShowToCopy.poster,
                    firstEpisode: tvShowToCopy.firstEpisode
                };
                
                showsToRender.push(copiedShow);
            }
            
            console.log(`复制完成，总卡片数量: ${showsToRender.length}`);
        }
        
        // 按顺序渲染所有电视剧（横向行、竖列排序）
        showsToRender.forEach((tvShow, index) => {
            const card = this.createPosterCard(tvShow);
            // 为每个卡片添加测试颜色和调试信息
            card.style.backgroundColor = testColors[index % testColors.length];
            card.style.border = '2px solid #ffffff';
            card.style.position = 'relative';
            
            // 添加调试信息
            const debugInfo = document.createElement('div');
            debugInfo.style.cssText = `
                position: absolute;
                top: 5px;
                left: 5px;
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 2px 4px;
                font-size: 10px;
                border-radius: 3px;
                z-index: 10;
            `;
            debugInfo.textContent = `${index + 1}`;
            card.appendChild(debugInfo);
            
            this.container.appendChild(card);
            
            // 初始化图片数据（用于无限滑动）
            this.img_data.push({
                node: card,
                x: 0, // 将在初始化后更新
                y: 0, // 将在初始化后更新
                mov_x: 0,
                mov_y: 0,
                ani: null
            });
        });
        
        // 初始化图片位置数据（延迟执行，确保DOM渲染完成）
        setTimeout(() => {
            this.initImagePositions();
        }, 100);
        
        // 添加网格调试信息
        let debugDiv = document.getElementById('grid-debug-info');
        if (!debugDiv) {
            debugDiv = document.createElement('div');
            debugDiv.id = 'grid-debug-info';
            debugDiv.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: rgba(0,0,0,0.9);
                color: white;
                padding: 10px;
                border-radius: 5px;
                font-family: monospace;
                font-size: 12px;
                z-index: 1000;
                border: 1px solid #666;
            `;
            document.body.appendChild(debugDiv);
        }
        
        this.updateDebugInfo();
    }
    
    initImagePositions() {
        if (!this.gsap || !this.img_data.length) return;
        
        console.log('初始化图片位置，海报数量:', this.img_data.length);
        
        // 获取容器的实际尺寸
        const containerRect = this.container.getBoundingClientRect();
        const posterWidth = this.poster_width;
        const posterHeight = this.poster_height;
        const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--poster-gap')) || 12;
        
        // 获取main-content的实际尺寸
        const mainContent = this.container.parentElement;
        if (!mainContent) return;
        
        // 计算main-content的可用空间
        const mainContentWidth = mainContent.clientWidth;
        const mainContentHeight = mainContent.clientHeight - 40; // 减去顶部padding
        
        // 计算最优的卡片布局 - 横向行、竖列排序
        const maxCardsPerRow = Math.floor(mainContentWidth / (posterWidth + gap));
        const maxRows = this.optimalRows || 2;
        
        // 如果卡片数量不足以填满区域，计算居中对齐的偏移
        const totalCardsWidth = maxCardsPerRow * (posterWidth + gap) - gap;
        const horizontalOffset = Math.max(0, (mainContentWidth - totalCardsWidth) / 2);
        
        // 计算垂直居中对齐
        const totalCardsHeight = maxRows * (posterHeight + gap) - gap;
        const verticalOffset = Math.max(0, (mainContentHeight - totalCardsHeight) / 2);
        
        // 重置所有位置
        this.img_data.forEach((img, index) => {
            // 计算当前卡片在哪一行哪一列（横向行、竖列排序）
            const row = index % maxRows;
            const col = Math.floor(index / maxRows);
            
            // 计算位置，从左侧 -posterWidth 的位置开始排列
            img.x = (-posterWidth) + col * (posterWidth + gap);
            img.y = verticalOffset + row * (posterHeight + gap);
            img.mov_x = 0;
            img.mov_y = 0;
            
            // 设置初始位置，无动画
            if (this.gsap) {
                this.gsap.set(img.node, {
                    x: img.x,
                    y: img.y,
                    position: 'absolute'
                });
            }
        });
        
        // 只在无限滑动模式下才需要设置固定尺寸
        if (this.gsap && this.container.classList.contains('infinite-scroll')) {
            // 设置容器尺寸为main-content的完整尺寸，实现填满效果
            this.container.style.width = mainContentWidth + 'px';
            this.container.style.height = mainContentHeight + 'px';
            
            console.log('填满main-content区域，尺寸:', mainContentWidth, 'x', mainContentHeight);
            console.log('卡片布局:', maxCardsPerRow, '列 x', maxRows, '行');
            console.log('偏移量:', horizontalOffset, 'x', verticalOffset);
        } else {
            // 普通网格模式下，让CSS Grid自动处理布局
            this.container.style.width = '100%';
            this.container.style.height = '100%';
        }
    }

    createPosterCard(tvShow) {
        const card = document.createElement('div');
        card.className = 'poster-card';
        
        const img = document.createElement('img');
        img.className = 'poster-image';
        img.alt = tvShow.name;
        
        if (tvShow.poster) {
            img.src = `file://${tvShow.poster}`;
        } else {
            img.style.background = 'linear-gradient(135deg, #2a2a2a, #404040)';
            img.style.display = 'flex';
            img.style.alignItems = 'center';
            img.style.justifyContent = 'center';
            img.style.color = 'rgba(255, 255, 255, 0.6)';
            img.style.fontSize = '14px';
            img.style.fontWeight = '500';
            img.textContent = '暂无海报';
        }
        
        const button = document.createElement('button');
        button.className = 'poster-button';
        button.textContent = tvShow.name;
        
        card.addEventListener('click', () => {
            this.playTvShow(tvShow);
        });
        
        card.appendChild(img);
        card.appendChild(button);
        
        return card;
    }

    playTvShow(tvShow) {
        const { ipcRenderer } = require('electron');
        
        console.log('点击电视剧:', tvShow.name);
        console.log('路径:', tvShow.path);
        console.log('第一集路径:', tvShow.firstEpisode);
        
        if (tvShow.firstEpisode) {
            ipcRenderer.send('play-tv-show', {
                name: tvShow.name,
                path: tvShow.path,
                firstEpisode: tvShow.firstEpisode
            });
        } else {
            alert(`未找到 ${tvShow.name} 的第一季第一集视频文件`);
        }
    }

    updateTvShows(tvShows) {
        this.tvShows = tvShows;
        this.renderGrid();
    }

    clear() {
        this.tvShows = [];
        this.container.innerHTML = '';
        
        const loading = document.getElementById('loading');
        const error = document.getElementById('error');
        const empty = document.getElementById('empty');
        
        if (loading) loading.style.display = 'block';
        if (error) error.style.display = 'none';
        if (empty) empty.style.display = 'none';
    }

    destroy() {
        // 清理所有动画和定时器
        if (this.scrollAnimationId) {
            cancelAnimationFrame(this.scrollAnimationId);
            this.scrollAnimationId = null;
        }
        
        // 清理GSAP动画
        if (this.gsap && this.img_data) {
            this.img_data.forEach(img => {
                if (img.ani) {
                    img.ani.kill();
                }
            });
        }
        
        this.container.innerHTML = '';
        this.tvShows = [];
        this.img_data = [];
    }
}

module.exports = PosterGrid;

})();