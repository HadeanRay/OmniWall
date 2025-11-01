(function() {
    // PosterGrid 类 - 管理电视剧海报网格显示
    class PosterGrid {
        
        /**
         * 获取中文字符的拼音首字母
         * @param {string} str - 中文字符串
         * @returns {string} 拼音首字母
         */
        getPinyinFirstLetter(str) {
            // 导入pinyin库用于处理中文字符到拼音的转换
            const pinyinLib = require('pinyin');
            
            if (!str || str.length === 0) return '#';
            
            const firstChar = str.charAt(0);
            
            // 如果是英文字母，直接返回大写
            if (/[a-zA-Z]/.test(firstChar)) {
                return firstChar.toUpperCase();
            }
            
            // 如果是数字，归为#组
            if (/\d/.test(firstChar)) {
                return '#';
            }
            
            // 如果是中文，使用pinyin库获取拼音首字母
            if (/[一-龥]/.test(firstChar)) {
                try {
                    // 使用pinyin库获取拼音，设置样式为拼音首字母
                    const pinyinResult = pinyinLib.default(firstChar, {
                        style: pinyinLib.default.STYLE_FIRST_LETTER, // 只获取首字母
                        heteronym: false // 不获取多音字
                    });
                    
                    // 获取结果并转为大写
                    if (pinyinResult && pinyinResult[0] && pinyinResult[0][0]) {
                        return pinyinResult[0][0].toUpperCase();
                    }
                } catch (error) {
                    console.error('获取拼音首字母时出错:', error);
                }
                return '#'; // 如果转换失败，归为#组
            }
            
            // 其他字符归为#组
            return '#';
        }
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
            
            // 排序相关
            this.currentSortType = 'name-asc'; // 默认排序方式
            
            // 分组相关
            this.groupedTvShows = []; // 存储分组后的电视剧数据
            
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

            // 监听排序变化事件
            document.addEventListener('sort-changed', (event) => {
                this.handleSortChange(event.detail.sortType);
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

        /**
         * 设置无限滚动事件监听器
         * 包括鼠标滚轮和触摸事件支持
         */
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

        /**
         * 处理触摸拖拽的无限滚动
         * @param {number} clientX - 触摸点X坐标
         * @param {number} clientY - 触摸点Y坐标
         */
        handleInfiniteScroll(clientX, clientY) {
            // 检查是否可以移动以及GSAP是否已加载
            if (!this.if_movable || !this.gsap) return;
            
            // 计算横向移动距离
            const distance_x = (clientX - this.mouse_x) / this.scale_nums;
            // 只处理横向移动，忽略纵向移动
            const distance_y = 0;
            
            // 计算循环距离参数
            const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--poster-gap')) || 12;
            
            // 重新计算循环距离，按照initImagePositions中的列布局逻辑准确计算
            // 分析img_data以确定实际列布局
            let groupTitleCount = 0;
            let tvShowCount = 0;
            
            // 遍历img_data统计各类型元素数量
            for (let i = 0; i < this.img_data.length; i++) {
                const img = this.img_data[i];
                if (img.type === 'group-title') {
                    groupTitleCount++;
                } else if (img.type === 'tv-show') {
                    tvShowCount++;
                }
            }
            
            // 按照initImagePositions中的算法计算实际列数
            // 首先构建列布局结构
            const columnLayout = [];
            let currentColumn = { type: null, count: 0, items: [] };
            
            for (let i = 0; i < this.img_data.length; i++) {
                const img = this.img_data[i];
                
                if (currentColumn.type === null) {
                    currentColumn.type = img.type;
                    currentColumn.count = 1;
                    currentColumn.items = [img];
                } else if (currentColumn.type === img.type) {
                    currentColumn.count++;
                    currentColumn.items.push(img);
                } else {
                    columnLayout.push({ ...currentColumn });
                    currentColumn = {
                        type: img.type,
                        count: 1,
                        items: [img]
                    };
                }
            }
            
            if (currentColumn.type !== null) {
                columnLayout.push({ ...currentColumn });
            }
            
            // 计算实际列数（按照initImagePositions中的逻辑）
            const maxRows = this.optimalRows || 2;
            let actualCols = 0;
            
            for (const column of columnLayout) {
                if (column.type === 'group-title') {
                    // 组标题列：每个组标题占一列（现在宽度为原来的一半）
                    actualCols += column.items.length;
                } else {
                    // 海报卡片列：按行数排列
                    let rows = 0;
                    for (let i = 0; i < column.items.length; i++) {
                        rows++;
                        if (rows >= maxRows) {
                            rows = 0;
                            actualCols++;
                        }
                    }
                    // 如果这列没有填满，也需要计算为一列
                    if (rows > 0) {
                        actualCols++;
                    }
                }
            }

            // 总列数 = 实际列数
            const totalCols = actualCols;
            
            // 循环距离 = 组标题数量 * (海报宽度/2 + 间隙) + 海报列数量 * (海报宽度 + 间隙) - 最后一个间隙
            // 需要分别计算组标题列和海报列的宽度贡献
            let groupTitleCols = 0;
            let posterCols = 0;
            
            // 重新计算各类型列的数量
            for (const column of columnLayout) {
                if (column.type === 'group-title') {
                    // 每个组标题占据海报宽度一半的空间
                    groupTitleCols += column.items.length;
                } else {
                    // 海报列按行数计算列数
                    let rows = 0;
                    for (let i = 0; i < column.items.length; i++) {
                        rows++;
                        if (rows >= maxRows) {
                            rows = 0;
                            posterCols++;
                        }
                    }
                    // 如果这列没有填满，也需要计算为一列
                    if (rows > 0) {
                        posterCols++;
                    }
                }
            }
            
            // 计算循环距离：组标题按半宽计算，海报按全宽计算
            const cycleDistance = groupTitleCols * (this.poster_width / 2 + gap) + 
                                posterCols * (this.poster_width + gap) - gap;
            
            // 更新所有海报和组标题的位置
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
            
            // 更新鼠标位置
            this.mouse_x = clientX;
            this.mouse_y = clientY;
        }

        /**
         * 处理鼠标滚轮的无限滚动
         * @param {number} scrollDistance - 滚动距离
         */
        handleInfiniteWheelScroll(scrollDistance) {
            // 检查GSAP是否已加载
            if (!this.gsap) return;
            
            // 使用滚轮距离作为横向移动距离 - 进一步降低移动距离
            const distance_x = scrollDistance * 0.6 / this.scale_nums; // 降低移动距离，使滚动更慢更平滑
            
            // 使用body窗口的实时宽度作为循环距离
            const bodyWidth = document.body.clientWidth;
            // 计算循环距离参数
            const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--poster-gap')) || 12;
            
            // 重新计算循环距离，按照initImagePositions中的列布局逻辑准确计算
            // 分析img_data以确定实际列布局
            let groupTitleCount = 0;
            let tvShowCount = 0;
            
            // 遍历img_data统计各类型元素数量
            for (let i = 0; i < this.img_data.length; i++) {
                const img = this.img_data[i];
                if (img.type === 'group-title') {
                    groupTitleCount++;
                } else if (img.type === 'tv-show') {
                    tvShowCount++;
                }
            }
            
            // 按照initImagePositions中的算法计算实际列数
            // 首先构建列布局结构
            const columnLayout = [];
            let currentColumn = { type: null, count: 0, items: [] };
            
            for (let i = 0; i < this.img_data.length; i++) {
                const img = this.img_data[i];
                
                if (currentColumn.type === null) {
                    currentColumn.type = img.type;
                    currentColumn.count = 1;
                    currentColumn.items = [img];
                } else if (currentColumn.type === img.type) {
                    currentColumn.count++;
                    currentColumn.items.push(img);
                } else {
                    columnLayout.push({ ...currentColumn });
                    currentColumn = {
                        type: img.type,
                        count: 1,
                        items: [img]
                    };
                }
            }
            
            if (currentColumn.type !== null) {
                columnLayout.push({ ...currentColumn });
            }
            
            // 计算实际列数（按照initImagePositions中的逻辑）
            const maxRows = this.optimalRows || 2;
            let actualCols = 0;
            
            for (const column of columnLayout) {
                if (column.type === 'group-title') {
                    // 组标题列：每个组标题占一列（现在宽度为原来的一半）
                    actualCols += column.items.length;
                } else {
                    // 海报卡片列：按行数排列
                    let rows = 0;
                    for (let i = 0; i < column.items.length; i++) {
                        rows++;
                        if (rows >= maxRows) {
                            rows = 0;
                            actualCols++;
                        }
                    }
                    // 如果这列没有填满，也需要计算为一列
                    if (rows > 0) {
                        actualCols++;
                    }
                }
            }

            // 总列数 = 实际列数
            const totalCols = actualCols;
            
            // 循环距离 = 组标题数量 * (海报宽度/2 + 间隙) + 海报列数量 * (海报宽度 + 间隙) - 最后一个间隙
            // 需要分别计算组标题列和海报列的宽度贡献
            let groupTitleCols = 0;
            let posterCols = 0;
            
            // 重新计算各类型列的数量
            for (const column of columnLayout) {
                if (column.type === 'group-title') {
                    // 每个组标题占据海报宽度一半的空间
                    groupTitleCols += column.items.length;
                } else {
                    // 海报列按行数计算列数
                    let rows = 0;
                    for (let i = 0; i < column.items.length; i++) {
                        rows++;
                        if (rows >= maxRows) {
                            rows = 0;
                            posterCols++;
                        }
                    }
                    // 如果这列没有填满，也需要计算为一列
                    if (rows > 0) {
                        posterCols++;
                    }
                }
            }
            
            // 计算循环距离：组标题按半宽计算，海报按全宽计算
            const cycleDistance = groupTitleCols * (this.poster_width / 2 + gap) + 
                                posterCols * (this.poster_width + gap) - gap;
            
            // 调试信息

            console.log(`无限滑动调试: 组标题数=${groupTitleCount}, 海报数=${tvShowCount}, 总列数=${totalCols}, 循环距离=${cycleDistance}px, 卡片宽度=${this.poster_width}px, body宽度=${bodyWidth}px`);
            
            // 更新所有海报和组标题的位置
            this.img_data.forEach((img) => {
                let duration = 0.8; // 增加动画时长，让滚动更平滑
                img.mov_x += distance_x;
                
                // 获取当前总位置
                const total_x = img.x + img.mov_x;
                
                // 水平边界循环检测 - 修复循环逻辑，确保两个区域无缝连接
                // 右侧边界：当卡片移动到bodyWidth + 海报宽度*2时，向左移动cycleDistance距离
                if (total_x > bodyWidth + this.poster_width * 2) {
                    img.mov_x -= cycleDistance;
                    duration = 0; // 瞬间移动
                    console.log(`右侧循环: 卡片位置=${total_x}, 循环到=${img.x + img.mov_x}`);
                }
                // 左侧边界：当卡片移动到-poster_width时，向右移动cycleDistance距离
                if (total_x < -this.poster_width - this.poster_width) {
                    img.mov_x += cycleDistance;
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

        /**
         * 平滑滚动实现
         * @param {HTMLElement} scrollContainer - 滚动容器
         * @param {number} deltaX - 滚动距离
         */
        smoothScroll(scrollContainer, deltaX) {
            // 验证参数
            if (!scrollContainer || typeof deltaX !== 'number') {
                console.warn('无效的滚动参数', { scrollContainer, deltaX });
                return;
            }

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
            const easeOutCubic = (t) => {
                if (t < 0 || t > 1) return Math.min(Math.max(t, 0), 1); // 确保t在[0,1]范围内
                return 1 - Math.pow(1 - t, 3);
            };
            
            // 动画时长（毫秒）- 根据滚动距离调整
            const baseDuration = 200;
            const scrollDistance = Math.abs(deltaX);
            const duration = Math.min(baseDuration + scrollDistance * 0.05, 500); // 减少最大时长
            
            const animateScroll = (currentTime) => {
                try {
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
                } catch (error) {
                    console.error('滚动动画执行出错:', error);
                    this.scrollAnimationId = null;
                }
            };
            
            // 启动动画
            this.scrollAnimationId = requestAnimationFrame(animateScroll);
        }

        // 移除惯性滚动功能，简化滚动逻辑

        /**
         * 更新海报尺寸以适应窗口大小
         */
        updatePosterSize() {
            try {
                const windowHeight = window.innerHeight;
                const windowWidth = window.innerWidth;
                
                // 获取main-content的实际尺寸
                const mainContent = this.container?.parentElement;
                if (!mainContent) {
                    console.warn('未找到main-content容器');
                    return;
                }
                
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
            } catch (error) {
                console.error('更新海报尺寸时出错:', error);
            }
        }

        /**
         * 更新网格调试信息显示
         */
        updateDebugInfo() {
            try {
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
            } catch (error) {
                console.error('更新调试信息时出错:', error);
            }
        }

        /**
         * 处理电视剧扫描结果
         * @param {Object} data - 扫描结果数据
         */
        handleTvShowsScanned(data) {
            try {
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
            } catch (error) {
                console.error('处理电视剧扫描结果时出错:', error);
                this.showError('处理电视剧数据时发生错误');
            }
        }

        /**
         * 处理排序变化
         * @param {string} sortType - 排序类型
         */
        handleSortChange(sortType) {
            try {
                console.log('排序方式改变:', sortType);
                this.currentSortType = sortType;
                
                // 重新渲染网格以应用新的排序
                if (this.tvShows && this.tvShows.length > 0) {
                    this.renderGrid();
                }
            } catch (error) {
                console.error('处理排序变化时出错:', error);
            }
        }

        /**
         * 排序电视剧列表
         * @param {Array} tvShows - 电视剧列表
         * @returns {Array} 排序后的电视剧列表
         */
        sortTvShows(tvShows) {
            if (!tvShows || tvShows.length === 0) return tvShows;

            try {
                const sortedShows = [...tvShows]; // 创建副本避免修改原数组

                switch (this.currentSortType) {
                    case 'name-asc':
                        return sortedShows.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
                    
                    case 'name-desc':
                        return sortedShows.sort((a, b) => b.name.localeCompare(a.name, 'zh-CN'));
                    
                    case 'date-asc':
                        // 按修改时间升序 (旧→新)
                        return sortedShows.sort((a, b) => {
                            const timeA = this.getTvShowModifyTime(a);
                            const timeB = this.getTvShowModifyTime(b);
                            return timeA - timeB;
                        });
                    
                    case 'date-desc':
                        // 按修改时间降序 (新→旧)
                        return sortedShows.sort((a, b) => {
                            const timeA = this.getTvShowModifyTime(a);
                            const timeB = this.getTvShowModifyTime(b);
                            return timeB - timeA;
                        });
                    
                    case 'seasons-asc':
                        // 按季数升序 (少→多)
                        return sortedShows.sort((a, b) => {
                            const seasonsA = this.getTvShowSeasonsCount(a);
                            const seasonsB = this.getTvShowSeasonsCount(b);
                            return seasonsA - seasonsB;
                        });
                    
                    case 'seasons-desc':
                        // 按季数降序 (多→少)
                        return sortedShows.sort((a, b) => {
                            const seasonsA = this.getTvShowSeasonsCount(a);
                            const seasonsB = this.getTvShowSeasonsCount(b);
                            return seasonsB - seasonsA;
                        });
                    
                    default:
                        return sortedShows;
                }
            } catch (error) {
                console.error('排序电视剧列表时出错:', error);
                return tvShows; // 返回原始列表
            }
        }

        /**
         * 获取电视剧的修改时间
         * @param {Object} tvShow - 电视剧对象
         * @returns {number} 修改时间的时间戳
         */
        getTvShowModifyTime(tvShow) {
            if (!tvShow || !tvShow.firstEpisode || !tvShow.firstEpisode.modifiedTime) {
                return 0;
            }
            try {
                return new Date(tvShow.firstEpisode.modifiedTime).getTime();
            } catch (error) {
                console.error('获取电视剧修改时间时出错:', error);
                return 0;
            }
        }

        /**
         * 获取电视剧的季数
         * @param {Object} tvShow - 电视剧对象
         * @returns {number} 季数
         */
        getTvShowSeasonsCount(tvShow) {
            if (!tvShow || !tvShow.seasons || !Array.isArray(tvShow.seasons)) {
                return 0;
            }
            return tvShow.seasons.length;
        }

        /**
         * 根据当前排序类型对电视剧进行分组
         * @param {Array} tvShows - 电视剧列表
         * @returns {Array} 分组后的电视剧数据
         */
        groupTvShows(tvShows) {
            if (!tvShows || tvShows.length === 0) return [];

            // 创建分组映射
            const groups = new Map();
            
            // 根据排序类型确定分组键
            const getGroupKey = (tvShow) => {
                switch (this.currentSortType) {
                    case 'name-asc':
                    case 'name-desc':
                        // 按首字母分组（包括拼音首字母）
                        return this.getPinyinFirstLetter(tvShow.name);
                    
                    case 'date-asc':
                    case 'date-desc':
                        // 按年份分组
                        const modifyTime = this.getTvShowModifyTime(tvShow);
                        if (modifyTime > 0) {
                            const year = new Date(modifyTime).getFullYear();
                            return year.toString();
                        }
                        return '未知';
                        
                    case 'seasons-asc':
                    case 'seasons-desc':
                        // 按季数分组
                        const seasonsCount = this.getTvShowSeasonsCount(tvShow);
                        if (seasonsCount === 0) return '无季数';
                        if (seasonsCount === 1) return '1季';
                        if (seasonsCount <= 5) return `${seasonsCount}季`;
                        return '5季以上';
                        
                    default:
                        return '默认';
                }
            };
            
            // 将电视剧分配到各组
            tvShows.forEach(tvShow => {
                const groupKey = getGroupKey(tvShow);
                if (!groups.has(groupKey)) {
                    groups.set(groupKey, []);
                }
                groups.get(groupKey).push(tvShow);
            });
            
            // 转换为数组格式并排序
            const groupedArray = [];
            
            // 根据排序类型确定组的排序方式
            let sortedGroupKeys = [];
            switch (this.currentSortType) {
                case 'name-asc':
                    // 按字母顺序排序组（包括拼音首字母）
                    sortedGroupKeys = Array.from(groups.keys()).sort((a, b) => {
                        // #组排在最后
                        if (a === '#' && b !== '#') return 1;
                        if (a !== '#' && b === '#') return -1;
                        // 其他按字母顺序排序
                        return a.localeCompare(b, 'zh-CN');
                    });
                    break;
                case 'name-desc':
                    // 按字母倒序排序组（包括拼音首字母）
                    sortedGroupKeys = Array.from(groups.keys()).sort((a, b) => {
                        // #组排在最后
                        if (a === '#' && b !== '#') return 1;
                        if (a !== '#' && b === '#') return -1;
                        // 其他按字母倒序排序
                        return b.localeCompare(a, 'zh-CN');
                    });
                    break;
                case 'date-asc':
                    // 按年份升序排序组
                    sortedGroupKeys = Array.from(groups.keys()).sort((a, b) => {
                        if (a === '未知') return 1;
                        if (b === '未知') return -1;
                        return parseInt(a) - parseInt(b);
                    });
                    break;
                case 'date-desc':
                    // 按年份降序排序组
                    sortedGroupKeys = Array.from(groups.keys()).sort((a, b) => {
                        if (a === '未知') return 1;
                        if (b === '未知') return -1;
                        return parseInt(b) - parseInt(a);
                    });
                    break;
                case 'seasons-asc':
                    // 按季数升序排序组
                    sortedGroupKeys = ['无季数', '1季', '2季', '3季', '4季', '5季', '5季以上'];
                    break;
                case 'seasons-desc':
                    // 按季数降序排序组
                    sortedGroupKeys = ['5季以上', '5季', '4季', '3季', '2季', '1季', '无季数'];
                    break;
                default:
                    sortedGroupKeys = Array.from(groups.keys());
            }
            
            // 构建最终的分组数组
            sortedGroupKeys.forEach(key => {
                if (groups.has(key)) {
                    groupedArray.push({
                        title: key,
                        items: groups.get(key)
                    });
                }
            });
            
            return groupedArray;
        }

        /**
         * 显示错误信息
         * @param {string} message - 错误消息
         */
        showError(message) {
            try {
                const loading = document.getElementById('loading');
                const error = document.getElementById('error');
                
                if (loading) loading.style.display = 'none';
                if (error) {
                    error.style.display = 'block';
                    error.textContent = message;
                }
            } catch (err) {
                console.error('显示错误信息时出错:', err);
            }
        }

        /**
         * 显示空状态
         */
        showEmptyState() {
            try {
                const loading = document.getElementById('loading');
                const empty = document.getElementById('empty');
                
                if (loading) loading.style.display = 'none';
                if (empty) empty.style.display = 'block';
            } catch (err) {
                console.error('显示空状态时出错:', err);
            }
        }

        /**
         * 隐藏加载状态
         */
        hideLoading() {
            try {
                const loading = document.getElementById('loading');
                if (loading) loading.style.display = 'none';
            } catch (err) {
                console.error('隐藏加载状态时出错:', err);
            }
        }

        /**
         * 渲染网格（支持分组显示）
         */
        renderGrid() {
            try {
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
                
                console.log(`渲染网格，总电视剧数: ${this.tvShows.length}, 行数: ${rows}, 排序方式: ${this.currentSortType}`);
                console.log(`容器尺寸: ${this.container.clientWidth}x${this.container.clientHeight}`);
                console.log(`CSS变量: --poster-width: ${getComputedStyle(document.documentElement).getPropertyValue('--poster-width')}, --poster-height: ${getComputedStyle(document.documentElement).getPropertyValue('--poster-height')}, --poster-gap: ${getComputedStyle(document.documentElement).getPropertyValue('--poster-gap')}`);
                
                // 重置图片数据数组
                this.img_data = [];
                
                // 应用排序
                const sortedShows = this.sortTvShows(this.tvShows);
                
                // 对排序后的电视剧进行分组
                this.groupedTvShows = this.groupTvShows(sortedShows);
                
                // 收集所有要渲染的项目（包括分组标题和电视剧卡片）
                let allItemsToRender = [];
                
                // 遍历分组，添加组标题和电视剧卡片
                this.groupedTvShows.forEach(group => {
                    // 添加组标题
                    allItemsToRender.push({
                        type: 'group-title',
                        title: group.title,
                        group: group
                    });
                    
                    // 添加组内的电视剧卡片
                    group.items.forEach(tvShow => {
                        allItemsToRender.push({
                            type: 'tv-show',
                            data: tvShow
                        });
                    });
                });
                
                // 直接使用原始项目列表
                let itemsToRender = [...allItemsToRender];
                
                // 按顺序渲染所有项目（横向行、竖列排序）
                itemsToRender.forEach((item, index) => {
                    let element;
                    
                    if (item.type === 'group-title') {
                        // 创建组标题元素
                        element = this.createGroupTitle(item.title);
                    } else if (item.type === 'tv-show') {
                        // 创建电视剧卡片元素
                        element = this.createPosterCard(item.data);
                        // 为每个卡片添加测试颜色和调试信息
                        element.style.backgroundColor = testColors[index % testColors.length];
                        element.style.border = '2px solid #ffffff';
                        element.style.position = 'relative';
                        
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
                        element.appendChild(debugInfo);
                    }
                    
                    if (element) {
                        this.container.appendChild(element);
                        
                        // 初始化图片数据（用于无限滑动），电视剧卡片和组标题都需要参与
                        if (item.type === 'tv-show' || item.type === 'group-title') {
                            this.img_data.push({
                                node: element,
                                x: 0, // 将在初始化后更新
                                y: 0, // 将在初始化后更新
                                mov_x: 0,
                                mov_y: 0,
                                ani: null,
                                type: item.type // 标记类型，用于区分处理
                            });
                        }
                    }
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
            } catch (error) {
                console.error('渲染网格时出错:', error);
                this.showError('渲染电视剧网格时发生错误');
            }
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
            
            // 重置所有位置，需要区分组标题和电视剧卡片
            // 为每个元素类型分别计算位置
            let currentCol = 0; // 当前列索引
            let currentRow = 0; // 当前行索引
            
            // 首先，需要分析img_data以确定布局结构
            // 创建一个映射来跟踪每一列的元素类型和数量
            const columnLayout = []; // 存储每列的元素信息
            let currentColumn = { type: null, count: 0, items: [] };
            
            // 分析img_data以确定每列的布局
            for (let i = 0; i < this.img_data.length; i++) {
                const img = this.img_data[i];
                
                // 如果当前元素与当前列的元素类型不同（或者这是第一个元素），开始新列
                if (currentColumn.type === null) {
                    // 这是第一个元素
                    currentColumn.type = img.type;
                    currentColumn.count = 1;
                    currentColumn.items = [img];
                } else if (currentColumn.type === img.type) {
                    // 当前元素与当前列的元素类型相同，继续添加
                    currentColumn.count++;
                    currentColumn.items.push(img);
                } else {
                    // 当前元素与当前列的元素类型不同，保存当前列并开始新列
                    columnLayout.push({ ...currentColumn });
                    currentColumn = {
                        type: img.type,
                        count: 1,
                        items: [img]
                    };
                }
            }
            
            // 添加最后一个列
            if (currentColumn.type !== null) {
                columnLayout.push({ ...currentColumn });
            }
            
            // 现在根据列布局设置每个元素的位置
            let totalXOffset = -posterWidth; // 从左侧开始
            let columnIndex = 0;
            
            for (const column of columnLayout) {
                if (column.type === 'group-title') {
                    // 组标题列：所有组标题占据相同位置（垂直居中）
                    // 注意：组标题现在宽度为海报宽度的一半
                    for (let i = 0; i < column.items.length; i++) {
                        const img = column.items[i];
                        img.x = totalXOffset;
                        img.y = verticalOffset; // 垂直居中
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
                    }
                    // 移动到下一列（按海报宽度的一半移动，因为组标题宽度已减半）
                    totalXOffset += (posterWidth / 2) + gap;
                } else { // 'tv-show' 列
                    // 海报卡片列：按网格排列
                    let row = 0;
                    for (let i = 0; i < column.items.length; i++) {
                        const img = column.items[i];
                        img.x = totalXOffset;
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
                        
                        row++;
                        // 如果达到最大行数，移到下一列
                        if (row >= maxRows) {
                            row = 0;
                            totalXOffset += posterWidth + gap;
                        }
                    }
                    
                    // 如果这列没有填满，也需要移动到下一列
                    if (row > 0) {
                        totalXOffset += posterWidth + gap;
                    }
                }
            }
            
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
            
            // 在下一个渲染周期调整字体大小
            requestAnimationFrame(() => {
                this.adjustFontSize(button);
            });
            
            card.addEventListener('click', () => {
                this.playTvShow(tvShow);
            });
            
            card.appendChild(img);
            card.appendChild(button);
            
            return card;
        }

        /**
         * 创建组标题元素
         * @param {string} title - 组标题
         * @returns {HTMLElement} 组标题元素
         */
        createGroupTitle(title) {
            const groupTitle = document.createElement('div');
            groupTitle.className = 'group-title';
            
            // 创建标题元素并放在顶部
            const titleElement = document.createElement('h2');
            titleElement.className = 'group-title-text';
            titleElement.textContent = title;
            
            // 添加样式，使其占据竖向一列的空间，宽度为原来的一半
            groupTitle.style.cssText = `
                width: calc(var(--poster-width) / 2); /* 宽度改为现有的一半 */
                height: calc((var(--poster-height) + var(--poster-gap)) * var(--grid-rows, 2) - var(--poster-gap));
                display: flex;
                flex-direction: column; /* 垂直布局 */
                align-items: center;
                justify-content: flex-start; /* 顶部对齐 */
                padding-top: 20px; /* 给标题留出空间 */
                flex-shrink: 0;
                position: relative;
                background: transparent; /* 透明背景 */
                border-radius: 12px;
                backdrop-filter: blur(10px);
                border: none; /* 取消边框 */
                box-shadow: none; /* 取消阴影 */
                box-sizing: border-box;
            `;
            
            titleElement.style.cssText = `
                font-size: 24px;
                font-weight: 600;
                color: #FFFFFF;
                margin: 0 0 15px 0; /* 底部留出更多空间 */
                position: relative;
                display: inline-block;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                width: 100%;
                text-align: center;
                z-index: 2; /* 确保标题在最上层 */
            `;
            
            // 添加从下到上透明度升高的渐变白线（在标题下方）
            const gradientLine = document.createElement('div');
            gradientLine.style.cssText = `
                position: relative; /* 相对于父容器定位 */
                width: 2px;
                height: calc(100% - 60px); /* 高度减去标题和间距的空间 */
                background: linear-gradient(
                    to top, 
                    rgba(255, 255, 255, 0) 0%, 
                    rgba(255, 255, 255, 0.1) 20%, 
                    rgba(255, 255, 255, 0.3) 50%, 
                    rgba(255, 255, 255, 0.6) 80%, 
                    rgba(255, 255, 255, 0.8) 100%
                );
                z-index: 1; /* 在标题后面 */
                margin-top: 10px; /* 在标题下方留出空间 */
            `;
            
            groupTitle.appendChild(titleElement);
            groupTitle.appendChild(gradientLine);
            
            return groupTitle;
        }

        /**
         * 自动调整按钮字体大小以适应容器宽度
         * @param {HTMLElement} button - 要调整字体大小的按钮元素
         */
        adjustFontSize(button) {
            // 确保元素已经添加到DOM中
            if (!button || !button.parentNode) return;
            
            // 获取按钮的计算样式
            const computedStyle = window.getComputedStyle(button);
            const buttonWidth = button.clientWidth - 
                parseFloat(computedStyle.paddingLeft) - 
                parseFloat(computedStyle.paddingRight);
            const buttonHeight = button.clientHeight - 
                parseFloat(computedStyle.paddingTop) - 
                parseFloat(computedStyle.paddingBottom);
            
            // 获取文本内容
            const text = button.textContent || button.innerText;
            if (!text) return;
            
            // 创建一个临时div元素来测量文本尺寸
            const tempDiv = document.createElement('div');
            tempDiv.style.fontSize = computedStyle.fontSize;
            tempDiv.style.fontFamily = computedStyle.fontFamily;
            tempDiv.style.fontWeight = computedStyle.fontWeight;
            tempDiv.style.visibility = 'hidden';
            tempDiv.style.position = 'absolute';
            tempDiv.style.whiteSpace = 'normal';
            tempDiv.style.wordWrap = 'break-word';
            tempDiv.style.textAlign = 'center';
            tempDiv.style.width = buttonWidth + 'px';
            tempDiv.style.lineHeight = computedStyle.lineHeight;
            tempDiv.textContent = text;
            
            document.body.appendChild(tempDiv);
            
            // 获取当前字体大小
            let fontSize = parseFloat(computedStyle.fontSize);
            const originalFontSize = fontSize;
            const minHeight = 8; // 最小字体大小
            
            // 如果文本高度超出按钮高度，则减小字体大小
            while (tempDiv.offsetHeight > buttonHeight && fontSize > minHeight) {
                fontSize -= 0.5;
                tempDiv.style.fontSize = fontSize + 'px';
            }
            
            // 如果文本高度远小于按钮高度且字体大小小于原始大小，则增大字体大小
            while (tempDiv.offsetHeight < buttonHeight * 0.8 && fontSize < originalFontSize) {
                fontSize += 0.5;
                tempDiv.style.fontSize = fontSize + 'px';
                
                // 如果增大后超出了按钮高度，则停止增大
                if (tempDiv.offsetHeight > buttonHeight) {
                    fontSize -= 0.5;
                    tempDiv.style.fontSize = fontSize + 'px';
                    break;
                }
            }
            
            // 应用新的字体大小
            button.style.fontSize = fontSize + 'px';
            
            // 清理临时元素
            document.body.removeChild(tempDiv);
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