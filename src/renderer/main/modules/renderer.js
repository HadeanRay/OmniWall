/**
 * 渲染模块 - 使用扁平化数据结构和虚拟滚动
 */
class Renderer {
    constructor(posterGrid) {
        this.posterGrid = posterGrid;
        // 扁平化的元素数据结构
        this.flatElements = [];
        // 缓存的DOM元素
        this.domElements = new Map();
        // 可见元素映射
        this.visibleElements = new Map();
    }

    /**
     * 创建海报图像元素（骨架屏模式）
     * @param {Object} tvShow - 电视剧数据
     * @returns {HTMLElement} 海报图像元素
     */
    createPosterImage(tvShow) {
        // 创建海报图像占位符元素
        const img = document.createElement('div');
        img.className = 'poster-image';
        img.alt = tvShow.name;
        img.style.background = 'linear-gradient(135deg, #2a2a2a, #404040)';
        img.style.display = 'flex';
        img.style.alignItems = 'center';
        img.style.justifyContent = 'center';
        img.style.color = 'rgba(255, 255, 255, 0.6)';
        img.style.fontSize = '14px';
        img.style.fontWeight = '500';
        img.textContent = '海报';
        img.dataset.posterSrc = tvShow.poster || '';
        img.dataset.localPosterPath = tvShow.localPosterPath || '';
        return img;
    }

    /**
     * 创建按钮元素（骨架屏模式）
     * @param {Object} tvShow - 电视剧数据
     * @returns {HTMLElement} 按钮元素
     */
    createPosterButton(tvShow) {
        const button = document.createElement('button');
        button.className = 'poster-button';
        button.textContent = tvShow.name;
        button.dataset.tvShowName = tvShow.name;
        return button;
    }

    /**
     * 创建电视剧卡片骨架元素（不加载海报图片，仅用于虚拟滚动优化）
     * @param {Object} tvShow - 电视剧数据
     * @returns {HTMLElement} 电视剧卡片骨架元素
     */
    createPosterCardSkeleton(tvShow) {
        const posterGrid = this.posterGrid;
        const card = document.createElement('div');
        card.className = 'poster-card';
        card.dataset.tvShowId = tvShow.id || tvShow.name;
        card.dataset.isLoaded = 'false';

        // 创建3D翻转容器
        const flipContainer = document.createElement('div');
        flipContainer.className = 'flip-container';

        // 创建卡片正面
        const flipFront = document.createElement('div');
        flipFront.className = 'flip-front';

        const img = this.createPosterImage(tvShow);
        const button = this.createPosterButton(tvShow);

        flipFront.appendChild(img);
        flipFront.appendChild(button);

        // 创建卡片背面
        const flipBack = document.createElement('div');
        flipBack.className = 'flip-back';

        // 创建最后播放信息显示元素
        const lastPlayedInfo = document.createElement('div');
        lastPlayedInfo.className = 'last-played-info';
        lastPlayedInfo.textContent = '开始播放'; // 默认显示"开始播放"
        lastPlayedInfo.dataset.tvShowPath = tvShow.path || ''; // 保存电视剧路径用于获取最后播放信息
        flipBack.appendChild(lastPlayedInfo);

        // 将正面和背面添加到翻转容器
        flipContainer.appendChild(flipFront);
        flipContainer.appendChild(flipBack);

        // 在下一个渲染周期调整字体大小
        requestAnimationFrame(() => {
            posterGrid.utils.adjustFontSize(button);
        });

        card.addEventListener('click', () => {
            posterGrid.utils.playTvShow(tvShow);
        });

        card.appendChild(flipContainer);

        return card;
    }

    /**
     * 创建组标题元素
     * @param {string} title - 组标题
     * @param {boolean} isFirstGroup - 是否为第一个组
     * @returns {HTMLElement} 组标题元素
     */
    createGroupTitle(title, isFirstGroup = false) {
        const groupTitle = document.createElement('div');
        groupTitle.className = 'group-title';
        
        // 创建标题元素并放在顶部
        const titleElement = document.createElement('h2');
        titleElement.className = 'group-title-text';
        
        // 检查标题是否为季度格式 (YYYY年QX)
        const quarterMatch = title.match(/(\d+)年Q(\d+)/);
        if (quarterMatch) {
            titleElement.innerHTML = '';
            
            // 创建年份元素（粗体大字体，仅数字）
            const yearElement = document.createElement('span');
            yearElement.textContent = quarterMatch[1];
            yearElement.style.cssText = `
                font-size: 28px;
                font-weight: bold;
                color: ${isFirstGroup ? '#00BCF2' : '#FFFFFF'};
                display: block;
            `;
            
            // 创建季度元素（细体小字体，"第几季"格式）
            const quarterElement = document.createElement('span');
            quarterElement.textContent = '第' + quarterMatch[2] + '季';
            quarterElement.style.cssText = `
                font-size: 16px;
                font-weight: normal;
                color: ${isFirstGroup ? '#80DEEA' : '#CCCCCC'};
                display: block;
                margin-top: 5px;
                line-height: 1.2;
            `;
            
            titleElement.appendChild(yearElement);
            titleElement.appendChild(quarterElement);
        } else {
            // 非季度格式，保持原有逻辑
            titleElement.textContent = title;
            // 如果是第一个组，使用亮蓝色，否则使用白色
            titleElement.style.color = isFirstGroup ? '#00BCF2' : '#FFFFFF';
        }
        
        // 添加样式，使其占据竖向一列的空间，宽度为原来的一半
        groupTitle.style.cssText = `
            width: calc(var(--poster-width) / 2);
            height: calc((var(--poster-height) + var(--poster-gap)) * var(--grid-rows, 2) - var(--poster-gap));
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            padding-top: 20px;
            flex-shrink: 0;
            position: relative;
            background: transparent;
            border-radius: 12px;
            backdrop-filter: blur(10px);
            border: none;
            box-shadow: none;
            box-sizing: border-box;
        `;
        
        titleElement.style.cssText = `
            font-size: 24px;
            font-weight: 600;
            color: ${isFirstGroup ? '#00BCF2' : '#FFFFFF'};
            margin: 0 0 20px 0;
            position: relative;
            display: inline-block;
            white-space: nowrap;
            overflow: visible;
            text-overflow: ellipsis;
            width: 100%;
            text-align: center;
            z-index: 2;
        `;
        
        // 添加从下到上透明度升高的渐变线（在标题下方）
        const gradientLine = document.createElement('div');
        gradientLine.style.cssText = `
            position: relative;
            width: 2px;
            height: calc(100% - 80px);
            background: linear-gradient(
                to top, 
                ${isFirstGroup ? 'rgba(0, 188, 242, 0)' : 'rgba(255, 255, 255, 0)'} 0%, 
                ${isFirstGroup ? 'rgba(0, 188, 242, 0.1)' : 'rgba(255, 255, 255, 0.1)'} 20%, 
                ${isFirstGroup ? 'rgba(0, 188, 242, 0.3)' : 'rgba(255, 255, 255, 0.3)'} 50%, 
                ${isFirstGroup ? 'rgba(0, 188, 242, 0.6)' : 'rgba(255, 255, 255, 0.6)'} 80%, 
                ${isFirstGroup ? 'rgba(0, 188, 242, 0.8)' : 'rgba(255, 255, 255, 0.8)'} 100%
            );
            z-index: 1;
            margin-top: 15px;
        `;
        
        groupTitle.appendChild(titleElement);
        groupTitle.appendChild(gradientLine);
        
        return groupTitle;
    }

    /**
     * 预计算完整的扁平化结构（结合分组和分组标题）
     * @returns {Array} 完整的扁平化结构数据
     */
    precomputeFlatStructure() {
        const posterGrid = this.posterGrid;

        // 应用排序
        const sortedShows = posterGrid.groupingSorting.sortTvShows(posterGrid.tvShows);

        // 对排序后的电视剧进行分组
        const groupedTvShows = posterGrid.groupingSorting.groupTvShows(sortedShows);

        // 使用新的扁平化数据结构
        let flatElements = [];
        let currentX = 0;
        let currentN = 0; // 在当前列中的行号
        const maxPossibleRows = posterGrid.optimalRows || 2;
        const posterWidth = posterGrid.poster_width || 160;
        const posterHeight = posterGrid.poster_height || 240;
        const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--poster-gap')) || 12;

        // 遍历分组，添加组标题和电视剧卡片
        groupedTvShows.forEach((group, groupIndex) => {
            // 添加组标题
            flatElements.push({
                type: "header",
                group: group.title,
                x: currentX,
                n: 0, // 标题始终在列的顶部
                data: group
            });

            // 增加x位置，因为标题占一列
            currentX += posterWidth / 2 + gap;

            // 添加组内的电视剧卡片
            group.items.forEach((tvShow, index) => {
                // 计算列和行位置
                const rowInColumn = currentN;
                flatElements.push({
                    type: "item",
                    tvShow: tvShow,
                    x: currentX,
                    n: rowInColumn, // 在当前列中的行号
                    data: tvShow
                });

                // 更新当前行号
                currentN++;
                // 如果达到最大行数，换到下一列
                if (currentN >= maxPossibleRows) {
                    currentN = 0;
                    currentX += posterWidth + gap;
                }
            });

            // 每个分组结束后，如果当前列未满，也换到下一列
            if (currentN > 0) {
                currentN = 0;
                currentX += posterWidth + gap;
            }
        });

        // 保存到实例变量
        this.flatElements = flatElements;
        // 打印完整的扁平化结构信息
        console.log('扁平化结构信息:');
        console.log('排序类型:', posterGrid.currentSortType);
        console.log('总元素数量:', flatElements.length);
        console.log('完整扁平化数据:', flatElements.map((el, idx) => `[${idx}] type=${el.type}, x=${el.x}, n=${el.n}, ${el.type === 'header' ? `group=${el.group}` : `tvShow=${el.tvShow?.name}`}`));
        console.log('结构示例（前10个元素）:', flatElements.slice(0, 10));
        return flatElements;
    }

    /**
     * 创建元素DOM并定位
     * @param {Object} element - 元素数据对象
     * @returns {HTMLElement} 创建的DOM元素
     */
    createElementDOM(element) {
        const posterGrid = this.posterGrid;
        let domElement;

        if (element.type === 'header') {
            // 创建组标题元素，第一个组使用亮蓝色样式
            const isFirstGroup = element === this.flatElements[0] || 
                (this.flatElements.findIndex(e => e.type === 'header') === this.flatElements.indexOf(element));
            domElement = this.createGroupTitle(element.group, isFirstGroup);
        } else if (element.type === 'item') {
            // 创建电视剧卡片元素（仅骨架，不加载海报）
            domElement = this.createPosterCardSkeleton(element.tvShow);
            domElement.style.position = 'absolute';
        }

        if (domElement) {
            // 设置元素的初始位置
            const distance_x = posterGrid.infiniteScroll?.currentScrollX || 0;
            const x = element.x - distance_x;
            const y = element.n * (posterGrid.poster_height + parseInt(getComputedStyle(document.documentElement).getPropertyValue('--poster-gap')) || 12);
            
            domElement.style.transform = `translate(${x}px, ${y}px)`;
            domElement.style.position = 'absolute';
        }

        return domElement;
    }

    /**
     * 渲染网格（使用扁平化结构和虚拟滚动）
     */
    renderGrid() {
        const posterGrid = this.posterGrid;
        try {
            // 清空现有的可见元素管理
            this.clearVisibleElements();
            
            // 清空容器
            posterGrid.container.innerHTML = '';
            posterGrid.container.style.display = 'block';
            posterGrid.container.style.position = 'relative';
            posterGrid.container.style.overflow = 'hidden';

            // 根据是否支持无限滑动添加相应的class
            if (posterGrid.gsap) {
                posterGrid.container.classList.add('infinite-scroll');
            }

            // 预计算扁平化结构
            this.precomputeFlatStructure();

            // 初始化可见元素管理
            this.updateVisibleElements();

            // 初始化图片位置数据（延迟执行，确保DOM渲染完成）
            setTimeout(() => {
                if (posterGrid.gsap) {
                    posterGrid.initImagePositions();
                }

                // 立即检查初始可见区域内的项目并加载海报
                if (posterGrid.infiniteScroll && typeof posterGrid.infiniteScroll.triggerVisibleElementsUpdate === 'function') {
                    posterGrid.infiniteScroll.triggerVisibleElementsUpdate();
                    
                    // 更新调试框
                    if (posterGrid.infiniteScroll.debugMode) {
                        posterGrid.infiniteScroll.updateDebugBoxes();
                    }
                }

                // 更新所有电视剧卡片的最后播放信息
                setTimeout(async () => {
                    const allCards = document.querySelectorAll('.poster-card[data-tv-show-id]');
                    for (const card of allCards) {
                        const tvShowId = card.dataset.tvShowId;
                        const tvShow = posterGrid.tvShows.find(show => show.id === tvShowId || show.name === tvShowId);
                        
                        if (tvShow && tvShow.path) {
                            // 使用posterGrid.utils更新最后播放信息
                            await posterGrid.utils.updateLastPlayedInfo(card, tvShow.path);
                        }
                    }
                }, 100); // 稍微延迟以确保DOM完全渲染

            }, 100);
        } catch (error) {
            console.error('渲染网格时出错:', error);
            posterGrid.utils.showError('渲染电视剧网格时发生错误');
        }
    }

    /**
     * 更新可见元素（虚拟滚动核心逻辑）
     */
    updateVisibleElements() {
        const posterGrid = this.posterGrid;
        const mainContent = posterGrid.container.parentElement;
        if (!mainContent || this.flatElements.length === 0) return;

        // 获取容器的可视区域
        const containerRect = mainContent.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;
        const distance_x = posterGrid.infiniteScroll?.currentScrollX || 0;

        // 计算缓冲区域 - 调试用区域 不要更改
        const bufferLeft = distance_x + (containerWidth / 4); // 左侧缓冲 调试用区域 不要更改
        const bufferRight = distance_x + (containerWidth / 4) * 3; // 右侧缓冲

        // 遍历所有元素，决定哪些需要渲染
        this.flatElements.forEach((element, index) => {
            const elementRight = element.x + posterGrid.poster_width;
            const elementLeft = element.x;

            // 检查元素是否在可见缓冲区域内
            const inVisibleBuffer = elementRight >= bufferLeft && elementLeft <= bufferRight;

            if (inVisibleBuffer && !this.visibleElements.has(index)) {
                // 元素进入可见区域，创建并添加DOM
                this.addElementToDOM(index);
                // 检查并加载海报
                if (element.type === 'item') {
                    this.checkAndLoadPoster(index);
                }
            } else if (!inVisibleBuffer && this.visibleElements.has(index)) {
                // 元素离开可见区域，从DOM移除
                this.removeElementFromDOM(index);
            }
        });
    }

    /**
     * 将元素添加到DOM中
     * @param {number} index - 元素索引
     */
    addElementToDOM(index) {
        const element = this.flatElements[index];
        if (!element) return;

        // 创建DOM元素
        const domElement = this.createElementDOM(element);

        if (domElement) {
            this.visibleElements.set(index, domElement);
            this.domElements.set(index, domElement);
            this.posterGrid.container.appendChild(domElement);
        }
    }

    /**
     * 从DOM中移除元素
     * @param {number} index - 元素索引
     */
    removeElementFromDOM(index) {
        const domElement = this.domElements.get(index);
        if (domElement && domElement.parentNode) {
            domElement.parentNode.removeChild(domElement);
            this.visibleElements.delete(index);
            this.domElements.delete(index);
        }
    }

    /**
     * 重新计算并更新可见元素（当滚动位置改变时调用）
     */
    refreshVisibleElements() {
        // 先移除所有当前可见的元素
        for (const [index] of this.visibleElements) {
            this.removeElementFromDOM(index);
        }

        // 重新计算并添加在新位置可见的元素
        this.updateVisibleElements();
    }
    
    /**
     * 清理可见元素
     */
    clearVisibleElements() {
        // 移除所有当前可见的元素
        for (const [index] of this.visibleElements) {
            this.removeElementFromDOM(index);
        }
        
        // 清空可见元素映射
        this.visibleElements.clear();
        this.domElements.clear();
    }

    /**
     * 检查并加载海报（如果元素在可见缓冲区内且未加载）
     * @param {number} index - 元素索引
     */
    checkAndLoadPoster(index) {
        const element = this.flatElements[index];
        if (!element || element.type !== 'item') return;

        const domElement = this.domElements.get(index);
        if (!domElement) return;

        // 检查海报是否已加载
        if (domElement.dataset.isLoaded !== 'true') {
            // 加载海报
            this.loadPosterForItem(domElement, element.tvShow);
        }
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
     * 检查并更新所有可见元素的海报加载状态
     */
    updateVisiblePosters() {
        // 遍历所有可见元素，检查是否需要加载或卸载海报
        for (const [index, element] of this.visibleElements) {
            const flatElement = this.flatElements[index];
            if (!flatElement || flatElement.type !== 'item') continue;

            // 获取容器的可视区域
            const mainContent = this.posterGrid.container.parentElement;
            if (!mainContent) continue;
            
            const containerRect = mainContent.getBoundingClientRect();
            const containerWidth = containerRect.width;
            const distance_x = this.posterGrid.infiniteScroll?.currentScrollX || 0;

            // 计算缓冲区域
            const bufferLeft = distance_x + (containerWidth / 4); // 左侧缓冲 调试用区域 不要更改
            const bufferRight = distance_x + (containerWidth / 4) * 3; // 右侧缓冲

            const elementRight = flatElement.x + this.posterGrid.poster_width;
            const elementLeft = flatElement.x;

            // 检查元素是否在可见缓冲区域内
            const inVisibleBuffer = elementRight >= bufferLeft && elementLeft <= bufferRight;

            if (inVisibleBuffer && element.dataset.isLoaded !== 'true') {
                // 元素在缓冲区内且未加载海报，加载海报
                this.loadPosterForItem(element, flatElement.tvShow);
            } else if (!inVisibleBuffer && element.dataset.isLoaded === 'true') {
                // 元素不在缓冲区内且已加载海报，卸载海报
                this.unloadPosterForItem(element, flatElement.tvShow);
            }
        }
    }
}

module.exports = Renderer;