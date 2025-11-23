/**
 * 虚拟滚动处理模块 - 管理滚动位置和可见元素更新
 */
class VirtualScroll {
    constructor(posterGrid) {
        this.posterGrid = posterGrid;
        // 设置初始滚动位置为 -1*(posterWidth+gap)
        const posterWidth = posterGrid.poster_width || 160;
        const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--poster-gap')) || 12;
        this.currentScrollX = -1 * (posterWidth + gap); // 当前滚动位置
        this.animationFrameId = null;
        this.debugMode = false; // 调试模式
        console.log('VirtualScroll初始化，currentScrollX:', this.currentScrollX);
    }

    /**
     * 设置虚拟滚动事件监听器
     * 包括鼠标滚轮和触摸事件支持
     */
    setupVirtualScrollListeners() {
        const posterGrid = this.posterGrid;

        if (!posterGrid.gsap) {
            console.warn('GSAP未加载，使用默认滚轮事件');
            this.setupWheelListener();
            return;
        }

        // 鼠标滚轮事件 - 横向滚动
        const wheelHandler = (event) => {
            event.preventDefault(); // 阻止默认滚动行为
            // 将滚轮的deltaY转换为横向移动距离 - 降低灵敏度并反转方向
            const scrollDistance = -event.deltaY * 0.8; // 取反deltaY以反转滚动方向，降低滚动灵敏度，使滚动更慢
            // 处理横向滚动
            this.handleWheelScroll(scrollDistance);
        };
        posterGrid.container.addEventListener('wheel', wheelHandler, { passive: false });

        // 触摸设备支持（保持拖拽模式，因为触摸更适合拖拽）
        const touchStartHandler = (event) => {
            posterGrid.if_movable = true;
            posterGrid.mouse_x = event.touches[0].clientX;
            posterGrid.mouse_y = event.touches[0].clientY;
            event.preventDefault();
        };
        const touchEndHandler = () => {
            posterGrid.if_movable = false;
        };
        const touchMoveHandler = (event) => {
            if (posterGrid.if_movable && posterGrid.gsap) {
                const clientX = event.touches[0].clientX;
                const clientY = event.touches[0].clientY;
                this.handleVirtualScroll(clientX, clientY);
                event.preventDefault();
            }
        };

        posterGrid.container.addEventListener('touchstart', touchStartHandler);
        posterGrid.container.addEventListener('touchend', touchEndHandler);
        posterGrid.container.addEventListener('touchmove', touchMoveHandler, { passive: false });

        // 鼠标拖拽支持
        const mouseDownHandler = (event) => {
            posterGrid.if_movable = true;
            posterGrid.mouse_x = event.clientX;
            posterGrid.mouse_y = event.clientY;
            event.preventDefault();
        };
        const mouseUpHandler = () => {
            posterGrid.if_movable = false;
        };
        const mouseLeaveHandler = () => {
            posterGrid.if_movable = false;
        };
        const mouseMoveHandler = (event) => {
            if (posterGrid.if_movable && posterGrid.gsap) {
                this.handleVirtualScroll(event.clientX, event.clientY);
                event.preventDefault();
            }
        };

        posterGrid.container.addEventListener('mousedown', mouseDownHandler);
        posterGrid.container.addEventListener('mouseup', mouseUpHandler);
        posterGrid.container.addEventListener('mouseleave', mouseLeaveHandler);
        posterGrid.container.addEventListener('mousemove', mouseMoveHandler, { passive: false });

        // 保存事件处理器以便后续移除
        this.wheelHandler = wheelHandler;
        this.touchStartHandler = touchStartHandler;
        this.touchEndHandler = touchEndHandler;
        this.touchMoveHandler = touchMoveHandler;
        this.mouseDownHandler = mouseDownHandler;
        this.mouseUpHandler = mouseUpHandler;
        this.mouseLeaveHandler = mouseLeaveHandler;
        this.mouseMoveHandler = mouseMoveHandler;
    }

    /**
     * 移除虚拟滚动事件监听器
     */
    removeVirtualScrollListeners() {
        const posterGrid = this.posterGrid;

        if (posterGrid.gsap) {
            posterGrid.container.removeEventListener('wheel', this.wheelHandler);
            posterGrid.container.removeEventListener('touchstart', this.touchStartHandler);
            posterGrid.container.removeEventListener('touchend', this.touchEndHandler);
            posterGrid.container.removeEventListener('touchmove', this.touchMoveHandler);
            posterGrid.container.removeEventListener('mousedown', this.mouseDownHandler);
            posterGrid.container.removeEventListener('mouseup', this.mouseUpHandler);
            posterGrid.container.removeEventListener('mouseleave', this.mouseLeaveHandler);
            posterGrid.container.removeEventListener('mousemove', this.mouseMoveHandler);
        } else {
            const mainContent = posterGrid.container.parentElement;
            if (mainContent) {
                mainContent.removeEventListener('wheel', this.defaultWheelHandler);
            }
        }
    }

    /**

     * 处理触摸拖拽的虚拟滚动

     * @param {number} clientX - 触摸点X坐标

     * @param {number} clientY - 触摸点Y坐标

     */

    handleVirtualScroll(clientX, clientY) {

        const posterGrid = this.posterGrid;



        // 检查是否可以移动以及GSAP是否已加载

        if (!posterGrid.if_movable || !posterGrid.gsap) return;



        // 计算横向移动距离

        const distance_x = (clientX - posterGrid.mouse_x) / posterGrid.scale_nums;



        // 只存储最新的滚动距离，不进行任何DOM操作或GSAP动画

        this.pendingScrollDistance = -distance_x;



        // 更新鼠标位置

        posterGrid.mouse_x = clientX;

        posterGrid.mouse_y = clientY;



        // 启动帧同步更新

        this.startFrameSyncUpdate();

    }

    /**

     * 更新元素位置（基于当前滚动位置）

     */

    updateElementPositions() {

        const posterGrid = this.posterGrid;

        const renderer = posterGrid.renderer;

        

        if (!renderer || !renderer.visibleElements || renderer.visibleElements.size === 0) return;

        

        // 使用性能优化的批量更新

        const containerHeight = window.innerHeight;

        const posterHeight = posterGrid.poster_height;

        const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--poster-gap')) || 12;

        const maxRows = posterGrid.optimalRows || 2;

        const totalContentHeight = maxRows * posterHeight + maxRows * gap;

        const startY = (containerHeight - totalContentHeight) / 2;

        const currentScrollX = this.currentScrollX; // 缓存当前滚动位置以避免重复访问

        

        // 使用requestAnimationFrame批量更新，减少布局重排

        if (posterGrid.gsap) {

            // 使用GSAP批量更新所有元素，但减少动画冲突

            renderer.visibleElements.forEach((element, index) => {

                const flatElement = renderer.flatElements[index];

                if (!flatElement || !element) return;

                

                // 计算新的位置

                const x = flatElement.x - currentScrollX;

                // 计算当前元素的y坐标



                const y = startY + flatElement.n * (posterHeight + gap);



                



                // 使用GSAP更新位置，保留缓动效果和防止动画堆积



                posterGrid.gsap.to(element, {



                    x: x,



                    y: y,



                    duration: 0.8, // 保持适当的动画时间



                    ease: "power1.out", // 使用缓动函数



                    overwrite: "auto" // 防止动画堆积



                });



            });



        } else {

            // 如果没有GSAP，使用transform3d启用硬件加速

            renderer.visibleElements.forEach((element, index) => {

                const flatElement = renderer.flatElements[index];

                if (!flatElement || !element) return;

                

                // 计算新的位置

                const x = flatElement.x - currentScrollX;

                // 计算当前元素的y坐标

                const y = startY + flatElement.n * (posterHeight + gap);

                

                // 使用transform3d启用硬件加速，减少重排

                element.style.transform = `translate3d(${x}px, ${y}px, 0)`;

            });

        }

    }

    /**

     * 处理鼠标滚轮的虚拟滚动

     * @param {number} scrollDistance - 滚动距离

     */

    handleWheelScroll(scrollDistance) {

        const posterGrid = this.posterGrid;



        // 检查GSAP是否已加载

        if (!posterGrid.gsap) return;



        // 只存储最新的滚动距离，不进行任何DOM操作或GSAP动画

        this.pendingScrollDistance = -scrollDistance * 1.2 / posterGrid.scale_nums;



        // 启动帧同步更新

        this.startFrameSyncUpdate();

    }

        /**

     * 触发renderer更新可见元素

     */

    triggerVisibleElementsUpdate() {

        const posterGrid = this.posterGrid;

        const renderer = posterGrid.renderer;



        if (renderer && typeof renderer.updateVisibleElements === 'function') {

            const startTime = performance.now();

            renderer.updateVisibleElements();

            const endTime = performance.now();

            posterGrid.performanceMonitor.recordRenderTime(endTime - startTime);

        }



        // 更新海报加载状态

        if (renderer && typeof renderer.updateVisiblePosters === 'function') {

            renderer.updateVisiblePosters();

        }

    }

    /**
     * 检查可见项目并加载需要显示的海报 - 空方法，由renderer模块处理
     */
    checkVisibleItems() {
        // 空方法，虚拟滚动逻辑现在由renderer模块处理
        // 这个方法保留是为了兼容性
    }

    /**
     * 为项目加载海报 - 空方法，由renderer模块处理
     */
    loadPosterForItem(element, tvShow) {
        // 空方法，海报加载逻辑现在由renderer模块处理
    }

    /**
     * 为项目卸载海报（恢复为骨架屏）- 空方法，由renderer模块处理
     */
    unloadPosterForItem(element, tvShow) {
        // 空方法，海报卸载逻辑现在由renderer模块处理
    }

    /**
     * 设置默认滚轮事件监听器
     */
    setupWheelListener() {
        const posterGrid = this.posterGrid;
        const mainContent = posterGrid.container.parentElement;
        
        if (!mainContent) return;
        
        const defaultWheelHandler = (event) => {
            event.preventDefault(); // 阻止默认滚动行为
            const scrollAmount = -event.deltaY * 1.5; // 取反deltaY以反转滚动方向，稍微增加滚动灵敏度
            this.smoothScroll(mainContent, scrollAmount);
        };
        mainContent.addEventListener('wheel', defaultWheelHandler, { passive: false });
        this.defaultWheelHandler = defaultWheelHandler;
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

    /**
     * 计算滚动边界
     * @returns {Object} 包含左右边界的对象
     */
    calculateScrollBoundaries() {
        const posterGrid = this.posterGrid;
        const renderer = posterGrid.renderer;

        // 左边界：-1 * (posterWidth + gap)
        const posterWidth = posterGrid.poster_width || 160;
        const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--poster-gap')) || 12;
        const leftBoundary = -1 * (posterWidth + gap);

        // 右边界：最后一个元素的x + (posterWidth + gap) * 2
        let rightBoundary = leftBoundary; // 默认值

        if (renderer && renderer.flatElements && renderer.flatElements.length > 0) {
            // 获取最后一个元素
            const lastElement = renderer.flatElements[renderer.flatElements.length - 1];
            if (lastElement) {
                rightBoundary = lastElement.x - document.body.clientWidth + (posterWidth + gap)*2 ;
            }
        }

        return {
            left: leftBoundary,
            right: rightBoundary
        };
    }

    /**
     * 应用硬边界限制（无拉伸效果）
     * @param {number} scrollX - 当前滚动位置
     * @param {Object} boundaries - 滚动边界
     * @returns {number} 应用边界限制后的滚动位置
     */
    applyHardBoundaries(scrollX, boundaries) {
        const { left, right } = boundaries;

        // 应用硬边界限制，不使用拉伸效果
        return Math.max(left, Math.min(scrollX, right));
    }

    /**
     * 更新调试框位置
     */
    updateDebugBoxes() {
        // 如果有调试元素，更新它们的位置
        const debugLeft = document.getElementById('debug-left');
        const debugRight = document.getElementById('debug-right');

        if (debugLeft) {
            debugLeft.style.left = `${this.currentScrollX + (document.body.clientWidth / 4)}px`;
        }

        if (debugRight) {
            debugRight.style.left = `${this.currentScrollX + (document.body.clientWidth / 4) * 3}px`;
        }
    }

    /**
     * 启动帧同步更新机制
     */
    startFrameSyncUpdate() {
        // 如果已经在更新中，不重复启动
        if (this.isUpdating) {
            // 但仍然更新最新的滚动距离
            return;
        }

        this.isUpdating = true;
        this.updateFrame();
    }

    /**
     * 帧同步更新函数
     */
    updateFrame() {
        // 检查是否有待处理的滚动距离
        if (this.pendingScrollDistance !== undefined && this.pendingScrollDistance !== 0) {
            // 应用滚动距离
            const oldScrollX = this.currentScrollX;
            this.currentScrollX -= this.pendingScrollDistance;

            // 计算边界限制并应用硬边界
            const boundaries = this.calculateScrollBoundaries();
            this.currentScrollX = this.applyHardBoundaries(this.currentScrollX, boundaries);

            // 如果滚动位置有实际变化，继续更新
            if (Math.abs(this.currentScrollX - oldScrollX) >= 0.1 || this.pendingScrollDistance !== 0) {
                // 重置待处理的滚动距离
                this.pendingScrollDistance = 0;

                // 通知renderer更新可见元素（优先处理可见性更新）
                this.triggerVisibleElementsUpdate();

                // 更新元素位置
                this.updateElementPositions();

                // 更新调试框
                if (this.debugMode) {
                    this.updateDebugBoxes();
                }
            } else {
                // 滚动位置没有变化，重置待处理的滚动距离
                this.pendingScrollDistance = 0;
            }
        }

        // 继续检查是否还有待处理的滚动操作
        if (this.pendingScrollDistance !== 0) {
            // 如果还有待处理的滚动距离，继续请求动画帧
            this.rafId = requestAnimationFrame(() => this.updateFrame());
        } else {
            // 没有待处理的滚动操作时，重置更新状态
            this.isUpdating = false;
        }
    }

    /**
     * 取消待处理的滚动操作
     */
    cancelPendingScroll() {
        this.pendingScrollDistance = 0;
        this.isUpdating = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }
}

module.exports = VirtualScroll;