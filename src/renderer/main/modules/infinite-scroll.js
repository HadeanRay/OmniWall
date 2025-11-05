/**
 * 无限滚动处理模块 - 使用扁平化数据结构和缓冲区域管理
 */

class InfiniteScroll {
    constructor(posterGrid) {
        this.posterGrid = posterGrid;
        this.currentScrollX = 0; // 当前滚动位置
        this.lastCheckTime = 0;
        this.animationFrameId = null;
        this.debugMode = false; // 调试模式
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

        // 检查可见项目并加载海报
        this.checkVisibleItems();

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

        // 检查可见项目并加载海报
        this.checkVisibleItems();

        // 更新调试框
        if (this.debugMode) {
            this.updateDebugBoxes();
        }
    }

    /**
     * 检查可见项目并加载需要显示的海报
     */
    checkVisibleItems() {
        const posterGrid = this.posterGrid;
        const renderer = posterGrid.renderer;
        const mainContent = posterGrid.container.parentElement;

        if (!mainContent || !renderer || !renderer.flatElements || renderer.flatElements.length === 0) return;

        // 获取容器的可视区域
        const containerRect = mainContent.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;

        // 计算缓冲区域
        const bufferLeft = this.currentScrollX + (containerWidth / 4); // 左侧缓冲
        const bufferRight = this.currentScrollX + (containerWidth / 4) * 3; // 右侧缓冲

        // 遍历所有元素，决定哪些需要渲染
        renderer.flatElements.forEach((element, index) => {
            const elementRight = element.x + posterGrid.poster_width;
            const elementLeft = element.x;

            // 检查元素是否在可见缓冲区域内
            const inVisibleBuffer = elementRight >= bufferLeft && elementLeft <= bufferRight;

            if (inVisibleBuffer && !renderer.visibleElements.has(index)) {
                // 元素进入可见区域，创建并添加DOM
                renderer.addElementToDOM(index);
            } else if (!inVisibleBuffer && renderer.visibleElements.has(index)) {
                // 元素离开可见区域，从DOM移除
                renderer.removeElementFromDOM(index);
            }
            
            // 对于电视剧卡片，检查是否需要加载海报
            if (element.type === 'item') {
                const domElement = renderer.domElements.get(index);
                if (domElement) {
                    if (inVisibleBuffer && !domElement.dataset.isLoaded) {
                        // 元素在缓冲区内且未加载海报，加载海报
                        this.loadPosterForItem(domElement, element.tvShow);
                    } else if (!inVisibleBuffer && domElement.dataset.isLoaded) {
                        // 元素不在缓冲区内且已加载海报，卸载海报
                        this.unloadPosterForItem(domElement, element.tvShow);
                    }
                }
            }
        });
    }

    /**
     * 为项目加载海报
     * @param {HTMLElement} element - DOM元素
     * @param {Object} tvShow - 电视剧数据
     */
    loadPosterForItem(element, tvShow) {
        const posterGrid = this.posterGrid;

        // 检查元素是否已加载
        if (!element || element.dataset.isLoaded === 'true') return;

        // 标记为已加载
        element.dataset.isLoaded = 'true';

        // 获取海报图像元素（占位符div）
        const imgElement = element.querySelector('.poster-image');
        const buttonElement = element.querySelector('.poster-button');

        if (!imgElement || !buttonElement) return;

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
     * @param {HTMLElement} element - DOM元素
     * @param {Object} tvShow - 电视剧数据
     */
    unloadPosterForItem(element, tvShow) {
        const posterGrid = this.posterGrid;

        // 检查元素是否已加载
        if (!element || element.dataset.isLoaded === 'false') return;

        // 标记为未加载
        element.dataset.isLoaded = 'false';

        // 获取海报图像元素
        const imgElement = element.querySelector('.poster-image');
        const buttonElement = element.querySelector('.poster-button');

        if (!imgElement || !buttonElement) return;

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
            debugLeft.style.left = `${this.currentScrollX - (document.body.clientWidth / 4)}px`;
        }
        
        if (debugRight) {
            debugRight.style.left = `${this.currentScrollX + (document.body.clientWidth / 4) * 3}px`;
        }
    }
}

module.exports = InfiniteScroll;