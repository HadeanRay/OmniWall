/**
 * 无限滚动处理模块
 */

class InfiniteScroll {
    constructor(posterGrid) {
        this.posterGrid = posterGrid;
        // 调试模式标志
        this.debugMode = true;
        // 调试框元素
        this.visibleAreaBox = null;
        this.prefetchAreaBox = null;
    }

    /**
     * 设置无限滚动事件监听器
     * 包括鼠标滚轮和触摸事件支持
     */
    setupInfiniteScrollListeners() {
        const posterGrid = this.posterGrid;

        if (!posterGrid.gsap) {
            console.warn('GSAP未加载，使用默认滚轮事件');
            this.setupWheelListener();
            return;
        }

        console.log('设置无限滑动事件监听器（鼠标滚轮模式）');

        // 创建调试框
        this.createDebugBoxes();

        // 鼠标滚轮事件 - 无限横向滚动
        posterGrid.container.addEventListener('wheel', (event) => {
            event.preventDefault(); // 阻止默认滚动行为

            // 将滚轮的deltaY转换为横向移动距离 - 降低灵敏度并反转方向
            const scrollDistance = -event.deltaY * 0.8; // 取反deltaY以反转滚动方向，降低滚动灵敏度，使滚动更慢

            // 处理无限横向滚动
            this.handleInfiniteWheelScroll(scrollDistance);
        }, { passive: false });

        // 触摸设备支持（保持拖拽模式，因为触摸更适合拖拽）
        posterGrid.container.addEventListener('touchstart', (event) => {
            posterGrid.if_movable = true;
            posterGrid.mouse_x = event.touches[0].clientX;
            posterGrid.mouse_y = event.touches[0].clientY;
            event.preventDefault();
        });

        posterGrid.container.addEventListener('touchend', () => {
            posterGrid.if_movable = false;
        });

        // 添加滚动事件监听器以实现虚拟滚动
        this.setupVirtualScrolling();
    }

    /**
     * 创建调试框元素
     */
    createDebugBoxes() {
        if (!this.debugMode) return;

        const mainContent = this.posterGrid.container.parentElement;
        if (!mainContent) return;

        // 创建可见区域调试框
        if (!this.visibleAreaBox) {
            this.visibleAreaBox = document.createElement('div');
            this.visibleAreaBox.id = 'visible-area-box';
            this.visibleAreaBox.style.cssText = `
                position: absolute;
                border: 2px solid #00ff00;
                background-color: rgba(0, 255, 0, 0.1);
                z-index: 1000;
                pointer-events: none;
                display: none;
            `;
            mainContent.appendChild(this.visibleAreaBox);
        }

        // 创建预加载区域调试框
        if (!this.prefetchAreaBox) {
            this.prefetchAreaBox = document.createElement('div');
            this.prefetchAreaBox.id = 'prefetch-area-box';
            this.prefetchAreaBox.style.cssText = `
                position: absolute;
                border: 2px solid #ff9900;
                background-color: rgba(255, 153, 0, 0.1);
                z-index: 999;
                pointer-events: none;
                display: none;
            `;
            mainContent.appendChild(this.prefetchAreaBox);
        }
    }

    /**
     * 更新调试框位置和大小
     */
    updateDebugBoxes() {
        if (!this.debugMode) return;

        const posterGrid = this.posterGrid;
        const mainContent = posterGrid.container.parentElement;
        if (!mainContent || !this.visibleAreaBox || !this.prefetchAreaBox) return;

        // 获取容器的可视区域
        const containerRect = mainContent.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;

        // 计算可见范围（进一步减小窗口大小以便观察）
        const visibleWidth = containerWidth * 0.4; // 可见区域宽度为容器的40%，更小以便观察预加载区域
        const visibleLeft = mainContent.scrollLeft + (containerWidth - visibleWidth) / 2;
        const visibleTop = 40; // 顶部偏移，提供更多空间
        const visibleHeight = containerHeight - 80; // 高度减去上下偏移，更小以便观察

        // 更新可见区域调试框
        this.visibleAreaBox.style.display = 'block';
        this.visibleAreaBox.style.left = `${visibleLeft}px`;
        this.visibleAreaBox.style.top = `${visibleTop}px`;
        this.visibleAreaBox.style.width = `${visibleWidth}px`;
        this.visibleAreaBox.style.height = `${visibleHeight}px`;
        this.visibleAreaBox.style.border = '2px solid #00ff00';
        this.visibleAreaBox.style.background = 'rgba(0, 255, 0, 0.05)';
        this.visibleAreaBox.style.boxSizing = 'border-box';
        this.visibleAreaBox.innerHTML = '<div style="position: absolute; top: -20px; left: 0; color: #00ff00; font-size: 12px; background: rgba(0,0,0,0.5); padding: 2px 4px;">可见区域</div>';

        // 计算预加载范围（比可见区域大一些，但仍然较小以便观察）
        const prefetchBuffer = 100; // 预加载缓冲区，减小以便更清楚地看到差异
        const prefetchWidth = visibleWidth + prefetchBuffer * 2;
        const prefetchLeft = visibleLeft - prefetchBuffer;
        const prefetchTop = visibleTop;
        const prefetchHeight = visibleHeight;

        // 更新预加载区域调试框
        this.prefetchAreaBox.style.display = 'block';
        this.prefetchAreaBox.style.left = `${prefetchLeft}px`;
        this.prefetchAreaBox.style.top = `${prefetchTop}px`;
        this.prefetchAreaBox.style.width = `${prefetchWidth}px`;
        this.prefetchAreaBox.style.height = `${prefetchHeight}px`;
        this.prefetchAreaBox.style.border = '2px solid #ff9900';
        this.prefetchAreaBox.style.background = 'rgba(255, 153, 0, 0.05)';
        this.prefetchAreaBox.style.boxSizing = 'border-box';
        this.prefetchAreaBox.innerHTML = '<div style="position: absolute; top: -20px; left: 0; color: #ff9900; font-size: 12px; background: rgba(0,0,0,0.5); padding: 2px 4px;">预加载区域</div>';
    }

    /**
     * 设置虚拟滚动事件监听器
     */
    setupVirtualScrolling() {
        const posterGrid = this.posterGrid;
        const mainContent = posterGrid.container.parentElement;

        if (!mainContent) return;

        // 创建防抖函数来避免频繁触发滚动事件
        let scrollTimer;
        const handleScroll = () => {
            if (scrollTimer) {
                clearTimeout(scrollTimer);
            }
            scrollTimer = setTimeout(() => {
                this.checkVisibleItems();
            }, 100); // 100ms防抖延迟
        };

        // 添加滚动事件监听器
        mainContent.addEventListener('scroll', handleScroll);
        posterGrid.virtualScrollListener = handleScroll;
    }

    /**
     * 检查可见项目并加载需要显示的海报
     */
    checkVisibleItems() {
        const posterGrid = this.posterGrid;
        const mainContent = posterGrid.container.parentElement;

        if (!mainContent || !posterGrid.img_data || posterGrid.img_data.length === 0) return;

        // 获取容器的可视区域
        const containerRect = mainContent.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;

        // 计算预加载区域（与调试框保持一致）
        const visibleWidth = containerWidth * 0.4; // 可见区域宽度为容器的40%
        const visibleLeft = mainContent.scrollLeft + (containerWidth - visibleWidth) / 2;
        const prefetchBuffer = 100; // 预加载缓冲区
        const prefetchLeft = visibleLeft - prefetchBuffer;
        const prefetchRight = visibleLeft + visibleWidth + prefetchBuffer;
        const prefetchTop = 40; // 与调试框保持一致
        const prefetchBottom = containerHeight - 40; // 与调试框保持一致

        // 使用节流优化，避免频繁检查
        if (!this.lastCheckTime) {
            this.lastCheckTime = 0;
        }
        const now = Date.now();
        if (now - this.lastCheckTime < 50) { // 提高检查频率到50ms，响应更及时
            return;
        }
        this.lastCheckTime = now;

        // 遍历所有项目，检查是否在预加载范围内
        let loadedCount = 0;
        let unloadedCount = 0;
        const maxLoadPerFrame = 8; // 每帧最多加载海报数
        const maxUnloadPerFrame = 10; // 每帧最多卸载海报数，快速释放内存

        for (let i = 0; i < posterGrid.img_data.length; i++) {
            const img = posterGrid.img_data[i];
            if (img.type !== 'tv-show') continue;

            // 获取项目的实际位置（考虑移动）
            const itemLeft = img.x + (img.mov_x || 0);
            const itemRight = itemLeft + posterGrid.poster_width;
            const itemTop = img.y + (img.mov_y || 0);
            const itemBottom = itemTop + posterGrid.poster_height;

            // 检查项目是否在预加载范围内
            const inPrefetchRange = itemRight >= prefetchLeft && itemLeft <= prefetchRight &&
                                  itemBottom >= prefetchTop && itemTop <= prefetchBottom;

            // 如果在预加载范围内且未加载，则加载
            if (inPrefetchRange && !img.isLoaded && loadedCount < maxLoadPerFrame) {
                this.loadPosterForItem(img);
                loadedCount++;
            }
            // 如果不在预加载范围内且已加载，则卸载
            else if (!inPrefetchRange && img.isLoaded && unloadedCount < maxUnloadPerFrame) {
                this.unloadPosterForItem(img);
                unloadedCount++;
            }
        }

        // 对于初始可见区域，如果当前滚动位置接近起点，确保部分初始海报被加载
        if (mainContent.scrollLeft <= (containerWidth * 0.2)) { // 如果滚动位置在容器宽度的20%以内，认为是接近初始位置
            // 确保前几个项目被加载（如果它们在预加载范围内或接近可见区域）
            const initialLoadCount = Math.min(10, posterGrid.img_data.length); // 减少初始加载数量
            for (let i = 0; i < initialLoadCount; i++) {
                const img = posterGrid.img_data[i];
                if (img && img.type === 'tv-show' && !img.isLoaded) {
                    // 检查是否接近可见区域，如果是则加载
                    const itemLeft = img.x + (img.mov_x || 0);
                    const itemRight = itemLeft + posterGrid.poster_width;
                    const itemTop = img.y + (img.mov_y || 0);
                    const itemBottom = itemTop + posterGrid.poster_height;

                    // 检查项目是否在扩展的预加载范围内（包含更宽的缓冲区）
                    const extendedPrefetchBuffer = 200; // 扩展缓冲区
                    const extendedPrefetchLeft = visibleLeft - extendedPrefetchBuffer;
                    const extendedPrefetchRight = visibleLeft + visibleWidth + extendedPrefetchBuffer;
                    const extendedPrefetchTop = 0; // 扩展到整个高度
                    const extendedPrefetchBottom = containerHeight;

                    const inExtendedRange = itemRight >= extendedPrefetchLeft && itemLeft <= extendedPrefetchRight &&
                                          itemBottom >= extendedPrefetchTop && itemTop <= extendedPrefetchBottom;

                    if (inExtendedRange && loadedCount < maxLoadPerFrame) {
                        this.loadPosterForItem(img);
                        loadedCount++;
                    }
                }
            }
        }

        // 更新调试框
        if (this.debugMode) {
            this.updateDebugBoxes();
        }
    }

    /**
     * 为项目加载海报
     * @param {Object} img - 图片数据对象
     */
    loadPosterForItem(img) {
        const posterGrid = this.posterGrid;

        // 检查元素是否存在且未加载
        if (!img.node || img.isLoaded || !img.data) return;

        // 标记为已加载
        img.isLoaded = true;

        // 获取海报图像元素（占位符div）
        const imgElement = img.node.querySelector('.poster-image');
        const buttonElement = img.node.querySelector('.poster-button');

        if (!imgElement || !buttonElement) return;

        // 获取电视剧数据
        const tvShow = img.data;

        // 创建真实的img元素来替换占位符
        const realImg = document.createElement('img');
        realImg.className = 'poster-image';
        realImg.alt = tvShow.name;
        realImg.loading = 'lazy';

        // 设置海报源
        if (tvShow.localPosterPath) {
            realImg.src = `file://${tvShow.localPosterPath}`;
        } else if (tvShow.poster && tvShow.path) {
            // 本地电视剧使用file://协议
            realImg.src = `file://${tvShow.poster}`;
        } else {
            // 没有海报，保持占位符样式
            imgElement.style.background = 'linear-gradient(135deg, #2a2a2a, #404040)';
            imgElement.style.display = 'flex';
            imgElement.style.alignItems = 'center';
            imgElement.style.justifyContent = 'center';
            imgElement.style.color = 'rgba(255, 255, 255, 0.6)';
            imgElement.style.fontSize = '14px';
            imgElement.style.fontWeight = '500';
            imgElement.textContent = '暂无海报';
            return;
        }

        // 替换占位符
        imgElement.parentNode.replaceChild(realImg, imgElement);

        // 更新按钮文本（如果需要）
        buttonElement.textContent = tvShow.name;

        // 调整字体大小
        posterGrid.utils.adjustFontSize(buttonElement);
    }

    /**
     * 为项目卸载海报（恢复为骨架屏）
     * @param {Object} img - 图片数据对象
     */
    unloadPosterForItem(img) {
        const posterGrid = this.posterGrid;

        // 检查元素是否存在且已加载
        if (!img.node || !img.isLoaded || !img.data) return;

        // 标记为未加载
        img.isLoaded = false;

        // 获取海报图像元素
        const imgElement = img.node.querySelector('.poster-image');
        const buttonElement = img.node.querySelector('.poster-button');

        if (!imgElement || !buttonElement) return;

        // 获取电视剧数据
        const tvShow = img.data;

        // 创建占位符元素来替换真实图片（模仿createPosterImage方法中的骨架屏样式）
        const placeholderImg = document.createElement('div');
        placeholderImg.className = 'poster-image';
        placeholderImg.alt = tvShow.name;
        placeholderImg.style.background = 'linear-gradient(135deg, #2a2a2a, #404040)';
        placeholderImg.style.display = 'flex';
        placeholderImg.style.alignItems = 'center';
        placeholderImg.style.justifyContent = 'center';
        placeholderImg.style.color = 'rgba(255, 255, 255, 0.6)';
        placeholderImg.style.fontSize = '14px';
        placeholderImg.style.fontWeight = '500';
        placeholderImg.textContent = '海报';
        placeholderImg.dataset.posterSrc = tvShow.poster || ''; // 保存海报URL以便后续加载
        placeholderImg.dataset.localPosterPath = tvShow.localPosterPath || ''; // 保存本地海报路径

        // 替换真实图片为占位符
        imgElement.parentNode.replaceChild(placeholderImg, imgElement);

        // 更新按钮文本
        buttonElement.textContent = tvShow.name;
        buttonElement.dataset.tvShowName = tvShow.name; // 保存名称以便后续使用

        // 调整字体大小
        posterGrid.utils.adjustFontSize(buttonElement);
    }

    /**
     * 计算循环距离，避免重复计算
     * @returns {number} 循环距离
     */
    calculateCycleDistance() {
        const posterGrid = this.posterGrid;
        const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--poster-gap')) || 12;

        if (!posterGrid.cachedCycleDistance) {
            // 分析img_data以确定实际列布局
            let groupTitleCols = 0;
            let posterCols = 0;
            let currentColumn = { type: null, count: 0, items: [] };

            for (let i = 0; i < posterGrid.img_data.length; i++) {
                const img = posterGrid.img_data[i];

                if (currentColumn.type === null) {
                    currentColumn.type = img.type;
                    currentColumn.count = 1;
                    currentColumn.items = [img];
                } else if (currentColumn.type === img.type) {
                    currentColumn.count++;
                    currentColumn.items.push(img);
                } else {
                    // 保存当前列并开始新列
                    if (currentColumn.type === 'group-title') {
                        groupTitleCols += currentColumn.count;
                    } else { // 'tv-show'
                        // 计算海报列数
                        const maxRows = posterGrid.optimalRows || 2;
                        let rows = 0;
                        for (let j = 0; j < currentColumn.count; j++) {
                            rows++;
                            if (rows >= maxRows) {
                                rows = 0;
                                posterCols++;
                            }
                        }
                        if (rows > 0) {
                            posterCols++;
                        }
                    }

                    currentColumn = {
                        type: img.type,
                        count: 1,
                        items: [img]
                    };
                }
            }

            // 处理最后一列
            if (currentColumn.type !== null) {
                if (currentColumn.type === 'group-title') {
                    groupTitleCols += currentColumn.count;
                } else { // 'tv-show'
                    const maxRows = posterGrid.optimalRows || 2;
                    let rows = 0;
                    for (let j = 0; j < currentColumn.count; j++) {
                        rows++;
                        if (rows >= maxRows) {
                            rows = 0;
                            posterCols++;
                        }
                    }
                    if (rows > 0) {
                        posterCols++;
                    }
                }
            }

            // 计算循环距离：组标题按半宽计算，海报按全宽计算
            posterGrid.cachedCycleDistance = groupTitleCols * (posterGrid.poster_width / 2 + gap) +
                                posterCols * (posterGrid.poster_width + gap);
        }

        return posterGrid.cachedCycleDistance;
    }

    /**
     * 处理触摸拖拽的无限滚动
     * @param {number} clientX - 触摸点X坐标
     * @param {number} clientY - 触摸点Y坐标
     */
    handleInfiniteScroll(clientX, clientY) {
        const posterGrid = this.posterGrid;

        // 检查是否可以移动以及GSAP是否已加载
        if (!posterGrid.if_movable || !posterGrid.gsap) return;

        // 计算横向移动距离
        const distance_x = (clientX - posterGrid.mouse_x) / posterGrid.scale_nums;
        // 只处理横向移动，忽略纵向移动
        const distance_y = 0;

        // 计算循环距离参数
        const bodyWidth = document.body.clientWidth;

        // 获取循环距离
        const cycleDistance = this.calculateCycleDistance();

        // 使用requestAnimationFrame优化动画性能
        if (!this.animationFrameId) {
            this.animationFrameId = requestAnimationFrame(() => {
                this.updatePositions(distance_x, cycleDistance, bodyWidth, posterGrid);
                this.animationFrameId = null;
            });
        }

        // 更新鼠标位置
        posterGrid.mouse_x = clientX;
        posterGrid.mouse_y = clientY;

        // 更新调试框
        if (this.debugMode) {
            this.updateDebugBoxes();
        }

        // 检查可见项目并加载海报
        this.checkVisibleItems();
    }

    /**
     * 更新元素位置的专门方法
     * @param {number} distance_x - 横向移动距离
     * @param {number} cycleDistance - 循环距离
     * @param {number} bodyWidth - 页面宽度
     * @param {Object} posterGrid - 海报网格实例
     */
    updatePositions(distance_x, cycleDistance, bodyWidth, posterGrid) {
        // 批量更新所有元素位置，避免重复的GSAP调用
        const updates = [];

        for (let i = 0; i < posterGrid.img_data.length; i++) {
            const img = posterGrid.img_data[i];
            let duration = 0.8; // 默认动画时长
            img.mov_x += distance_x;

            // 获取当前总位置
            const total_x = img.x + img.mov_x;

            // 水平边界循环检测 - 基于实际的列宽总距离
            if (total_x > bodyWidth + posterGrid.poster_width*2) {
                img.mov_x -= (cycleDistance);
                duration = 0; // 瞬间移动
            }
            if (total_x < -posterGrid.poster_width*2) {
                img.mov_x += (cycleDistance );
                duration = 0;
            }

            // 收集需要更新的元素
            updates.push({
                img: img,
                target_x: img.x + img.mov_x,
                target_y: img.y,
                duration: duration
            });
        }

        // 批量应用动画更新
        updates.forEach(update => {
            const { img, target_x, target_y, duration } = update;

            // 停止之前的动画
            if (img.ani) img.ani.kill();

            // 应用新动画 - 只横向移动
            img.ani = posterGrid.gsap.to(img.node, {
                x: target_x,
                y: target_y, // 保持纵向位置不变
                duration: duration,
                ease: duration > 0 ? 'power4.out' : null // 瞬间移动不需要缓动
            });
        });
    }

    /**
     * 获取当前可见范围内的元素索引
     * @returns {Object} 包含start和end索引的对象
     */
    getVisibleRange() {
        const posterGrid = this.posterGrid;
        if (!posterGrid.container || !posterGrid.img_data || posterGrid.img_data.length === 0) {
            return { start: 0, end: 0 };
        }

        // 获取容器的可视区域
        const containerRect = posterGrid.container.getBoundingClientRect();
        const containerLeft = containerRect.left;
        const containerWidth = containerRect.width;

        // 计算可见范围
        let startIndex = 0;
        let endIndex = posterGrid.img_data.length - 1;

        // 简化实现：返回一个较大的范围以确保流畅滚动
        // 在实际应用中，可以根据具体位置计算精确的可见范围
        const buffer = 20; // 缓冲区元素数量
        const middleIndex = Math.floor(posterGrid.img_data.length / 2);
        startIndex = Math.max(0, middleIndex - buffer);
        endIndex = Math.min(posterGrid.img_data.length - 1, middleIndex + buffer);

        return { start: startIndex, end: endIndex };
    }

    /**
     * 清除缓存的循环距离
     */
    clearCachedCycleDistance() {
        if (this.posterGrid) {
            this.posterGrid.cachedCycleDistance = null;
        }
    }

    /**
     * 处理鼠标滚轮的无限滚动
     * @param {number} scrollDistance - 滚动距离
     */
    handleInfiniteWheelScroll(scrollDistance) {
        const posterGrid = this.posterGrid;

        // 检查GSAP是否已加载
        if (!posterGrid.gsap) return;

        // 使用滚轮距离作为横向移动距离 - 进一步降低移动距离
        const distance_x = scrollDistance * 0.6 / posterGrid.scale_nums; // 降低移动距离，使滚动更平滑更慢
        const bodyWidth = document.body.clientWidth;
        // 计算循环距离参数
        const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--poster-gap')) || 12;

        // 获取循环距离
        const cycleDistance = this.calculateCycleDistance();

        // 更新所有元素的位置，确保无限滚动正常工作
        for (let i = 0; i < posterGrid.img_data.length; i++) {
            const img = posterGrid.img_data[i];
            let duration = 0.8; // 增加动画时长，让滚动更平滑
            img.mov_x += distance_x;

            // 获取当前总位置
            const total_x = img.x + img.mov_x;

            // 水平边界循环检测 - 修复循环逻辑，确保两个区域无缝连接
            // 右侧边界：当卡片移动到cycleDistance + 海报宽度时，向左移动cycleDistance距离
            if (total_x > bodyWidth + posterGrid.poster_width*2) {
                img.mov_x -= cycleDistance;
                duration = 0; // 瞬间移动
            }
            // 左侧边界：当卡片移动到-poster_width时，向右移动cycleDistance距离
            if (total_x < -posterGrid.poster_width*2) {
                img.mov_x += cycleDistance;
                duration = 0;
            }

            // 停止之前的动画
            if (img.ani) img.ani.kill();

            // 计算新的目标位置 - 只横向移动
            const target_x = img.x + img.mov_x;
            const target_y = img.y; // 保持原始纵向位置

            // 应用新动画 - 使用更平滑的缓动函数
            img.ani = posterGrid.gsap.to(img.node, {
                x: target_x,
                y: target_y, // 保持纵向位置不变
                duration: duration,
                ease: 'power3.out' // 使用更平滑的缓动函数
            });
        }

        // 更新调试框
        if (this.debugMode) {
            this.updateDebugBoxes();
        }

        // 检查可见项目并加载海报
        this.checkVisibleItems();
    }

    /**
     * 设置默认滚轮事件监听器
     */
    setupWheelListener() {
        const posterGrid = this.posterGrid; // 添加这一行来获取posterGrid引用
        posterGrid.container.addEventListener('wheel', (event) => {
            event.preventDefault(); // 阻止默认滚动行为

            const scrollContainer = posterGrid.container.parentElement;
            if (!scrollContainer) return;

            const scrollAmount = -event.deltaY * 1.5; // 取反deltaY以反转滚动方向，稍微增加滚动灵敏度
            this.smoothScroll(scrollContainer, scrollAmount);
        }, { passive: false });
    }

    /**
     * 平滑滚动实现
     * @param {HTMLElement} scrollContainer - 滚动容器
     * @param {number} deltaX - 滚动距离
     */
    smoothScroll(scrollContainer, deltaX) {
        const posterGrid = this.posterGrid;

        // 验证参数
        if (!scrollContainer || typeof deltaX !== 'number') {
            console.warn('无效的滚动参数', { scrollContainer, deltaX });
            return;
        }

        // 如果已经有滚动动画在进行，先停止它
        if (posterGrid.scrollAnimationId) {
            cancelAnimationFrame(posterGrid.scrollAnimationId);
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
            posterGrid.scrollAnimationId = null;
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

                // 更新调试框
                if (this.debugMode) {
                    this.updateDebugBoxes();
                }

                // 如果动画未完成，继续下一帧
                if (progress < 1) {
                    posterGrid.scrollAnimationId = requestAnimationFrame(animateScroll);
                } else {
                    posterGrid.scrollAnimationId = null;
                }
            } catch (error) {
                console.error('滚动动画执行出错:', error);
                posterGrid.scrollAnimationId = null;
            }
        };

        // 启动动画
        posterGrid.scrollAnimationId = requestAnimationFrame(animateScroll);
    }
}

module.exports = InfiniteScroll;