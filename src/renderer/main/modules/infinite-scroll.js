/**
 * 无限滚动处理模块 - 仅保留基本滚动支持，虚拟滚动逻辑由Renderer模块处理
 */

class InfiniteScroll {
    constructor(posterGrid) {
        this.posterGrid = posterGrid;
        this.currentScrollX = 0; // 当前滚动位置
        this.animationFrameId = null;
        this.debugMode = false; // 调试模式
        console.log('InfiniteScroll初始化，currentScrollX:', this.currentScrollX);
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

        // 触摸移动事件
        posterGrid.container.addEventListener('touchmove', (event) => {
            if (posterGrid.if_movable && posterGrid.gsap) {
                const clientX = event.touches[0].clientX;
                const clientY = event.touches[0].clientY;
                this.handleInfiniteScroll(clientX, clientY);
                event.preventDefault();
            }
        }, { passive: false });

        // 鼠标拖拽支持
        posterGrid.container.addEventListener('mousedown', (event) => {
            posterGrid.if_movable = true;
            posterGrid.mouse_x = event.clientX;
            posterGrid.mouse_y = event.clientY;
            event.preventDefault();
        });

        posterGrid.container.addEventListener('mouseup', () => {
            posterGrid.if_movable = false;
        });

        posterGrid.container.addEventListener('mouseleave', () => {
            posterGrid.if_movable = false;
        });

        posterGrid.container.addEventListener('mousemove', (event) => {
            if (posterGrid.if_movable && posterGrid.gsap) {
                this.handleInfiniteScroll(event.clientX, event.clientY);
                event.preventDefault();
            }
        }, { passive: false });
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
        
        // 更新滚动位置
        this.currentScrollX -= distance_x;
        
        // 更新鼠标位置
        posterGrid.mouse_x = clientX;
        posterGrid.mouse_y = clientY;

        // 更新元素位置
        this.updateElementPositions();

        // 通知renderer更新可见元素
        this.triggerVisibleElementsUpdate();

        // 更新调试框
        if (this.debugMode) {
            this.updateDebugBoxes();
        }
    }

    /**
     * 更新元素位置（基于当前滚动位置）
     */
    updateElementPositions() {
        const posterGrid = this.posterGrid;
        const renderer = posterGrid.renderer;
        
        if (!renderer || !renderer.flatElements || renderer.flatElements.length === 0) return;
        
        // 更新所有可见元素的位置
        for (const [index, element] of renderer.visibleElements) {
            const flatElement = renderer.flatElements[index];
            if (!flatElement || !element) continue;
            
            // 计算新的位置
            const x = flatElement.x - this.currentScrollX;
            const y = flatElement.n * (posterGrid.poster_height + parseInt(getComputedStyle(document.documentElement).getPropertyValue('--poster-gap')) || 12);
            
            // 应用变换
            element.style.transform = `translate(${x}px, ${y}px)`;
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

        // 更新滚动位置
        this.currentScrollX -= scrollDistance * 0.6 / posterGrid.scale_nums;
        
        // 更新元素位置
        this.updateElementPositions();

        // 通知renderer更新可见元素
        this.triggerVisibleElementsUpdate();

        // 更新调试框
        if (this.debugMode) {
            this.updateDebugBoxes();
        }
    }

    /**
     * 触发renderer更新可见元素
     */
    triggerVisibleElementsUpdate() {
        const posterGrid = this.posterGrid;
        const renderer = posterGrid.renderer;
        
        if (renderer && typeof renderer.updateVisibleElements === 'function') {
            renderer.updateVisibleElements();
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
        
        mainContent.addEventListener('wheel', (event) => {
            event.preventDefault(); // 阻止默认滚动行为

            const scrollAmount = -event.deltaY * 1.5; // 取反deltaY以反转滚动方向，稍微增加滚动灵敏度
            this.smoothScroll(mainContent, scrollAmount);
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
}

module.exports = InfiniteScroll;