/**
 * 渲染模块
 */
class Renderer {
    constructor(posterGrid) {
        this.posterGrid = posterGrid;
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

        const img = this.createPosterImage(tvShow);
        const button = this.createPosterButton(tvShow);

        // 在下一个渲染周期调整字体大小
        requestAnimationFrame(() => {
            posterGrid.utils.adjustFontSize(button);
        });

        card.addEventListener('click', () => {
            posterGrid.utils.playTvShow(tvShow);
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
                color: #FFFFFF;
                display: block;
            `;
            
            // 创建季度元素（细体小字体，"第几季"格式）
            const quarterElement = document.createElement('span');
            quarterElement.textContent = '第' + quarterMatch[2] + '季';
            quarterElement.style.cssText = `
                font-size: 16px;
                font-weight: normal;
                color: #CCCCCC;
                display: block;
                margin-top: 5px;
                line-height: 1.2;
            `;
            
            titleElement.appendChild(yearElement);
            titleElement.appendChild(quarterElement);
        } else {
            // 非季度格式，保持原有逻辑
            titleElement.textContent = title;
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
            color: #FFFFFF;
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
        
        // 添加从下到上透明度升高的渐变白线（在标题下方）
        const gradientLine = document.createElement('div');
        gradientLine.style.cssText = `
            position: relative;
            width: 2px;
            height: calc(100% - 80px);
            background: linear-gradient(
                to top, 
                rgba(255, 255, 255, 0) 0%, 
                rgba(255, 255, 255, 0.1) 20%, 
                rgba(255, 255, 255, 0.3) 50%, 
                rgba(255, 255, 255, 0.6) 80%, 
                rgba(255, 255, 255, 0.8) 100%
            );
            z-index: 1;
            margin-top: 15px;
        `;
        
        groupTitle.appendChild(titleElement);
        groupTitle.appendChild(gradientLine);
        
        return groupTitle;
    }

    /**
     * 预计算完整的骨架屏结构（结合分组和分组标题）
     * @returns {Array} 完整的骨架屏结构数据
     */
    precomputeSkeletonStructure() {
        const posterGrid = this.posterGrid;

        // 应用排序
        const sortedShows = posterGrid.groupingSorting.sortTvShows(posterGrid.tvShows);

        // 对排序后的电视剧进行分组
        const groupedTvShows = posterGrid.groupingSorting.groupTvShows(sortedShows);

        // 收集所有要渲染的项目（包括分组标题和电视剧卡片）
        let allItemsToRender = [];

        // 遍历分组，添加组标题和电视剧卡片
        groupedTvShows.forEach(group => {
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

        return allItemsToRender;
    }

    /**
     * 渲染网格（支持分组显示和虚拟滚动）
     */
    renderGrid() {
        const posterGrid = this.posterGrid;
        try {
            // 在重新渲染前停止所有正在进行的动画
            if (posterGrid.gsap && posterGrid.img_data) {
                posterGrid.img_data.forEach(img => {
                    if (img.ani) {
                        img.ani.kill();
                        img.ani = null;
                    }
                });
            }

            // 取消正在进行的滚动动画
            if (posterGrid.scrollAnimationId) {
                cancelAnimationFrame(posterGrid.scrollAnimationId);
                posterGrid.scrollAnimationId = null;
            }

            posterGrid.container.style.display = 'grid';
            posterGrid.container.innerHTML = '';

            // 根据是否支持无限滑动添加相应的class
            if (posterGrid.gsap) {
                posterGrid.container.classList.add('infinite-scroll');
            }

            // 确保行数已计算，如果没有则使用默认2行
            const rows = posterGrid.optimalRows || 2;

            console.log(`渲染网格，总电视剧数: ${posterGrid.tvShows.length}, 行数: ${rows}, 排序方式: ${posterGrid.currentSortType}`);
            console.log(`容器尺寸: ${posterGrid.container.clientWidth}x${posterGrid.container.clientHeight}`);
            console.log(`CSS变量: --poster-width: ${getComputedStyle(document.documentElement).getPropertyValue('--poster-width')}, --poster-height: ${getComputedStyle(document.documentElement).getPropertyValue('--poster-height')}, --poster-gap: ${getComputedStyle(document.documentElement).getPropertyValue('--poster-gap')}`);

            // 重置图片数据数组
            posterGrid.img_data = [];

            // 预计算完整的骨架屏结构
            const allItemsToRender = this.precomputeSkeletonStructure();

            console.log(`渲染: 总项目数 ${allItemsToRender.length}`);

            // 按顺序渲染所有项目（横向行、竖列排序）
            allItemsToRender.forEach((item, index) => {
                let element;

                if (item.type === 'group-title') {
                    // 创建组标题元素
                    element = this.createGroupTitle(item.title);
                } else if (item.type === 'tv-show') {
                    // 创建电视剧卡片元素（仅骨架，不加载海报）
                    element = this.createPosterCardSkeleton(item.data);
                    element.style.position = 'relative';
                }

                if (element) {
                    posterGrid.container.appendChild(element);

                    // 初始化图片数据（用于无限滑动），电视剧卡片和组标题都需要参与
                    if (item.type === 'tv-show' || item.type === 'group-title') {
                        posterGrid.img_data.push({
                            node: element,
                            x: 0, // 将在初始化后更新
                            y: 0, // 将在初始化后更新
                            mov_x: 0,
                            mov_y: 0,
                            ani: null,
                            type: item.type, // 标记类型，用于区分处理
                            originalIndex: index, // 保存原始索引
                            data: item.data, // 保存原始数据用于懒加载
                            isLoaded: item.type === 'group-title' // 组标题立即加载，海报稍后加载
                        });
                    }
                }
            });

            // 保存总项目信息
            posterGrid.totalItems = allItemsToRender.length;
            posterGrid.allItemsToRender = allItemsToRender;
            posterGrid.currentStartIndex = 0;
            posterGrid.currentEndIndex = allItemsToRender.length - 1;

            // 初始化图片位置数据（延迟执行，确保DOM渲染完成）
            setTimeout(() => {
                posterGrid.initImagePositions();

                // 立即检查初始可见区域内的项目并加载海报
                if (posterGrid.gsap) {
                    // 在无限滚动模式下，检查初始可见项目
                    setTimeout(() => {
                        const infiniteScroll = posterGrid.infiniteScroll;
                        if (infiniteScroll && typeof infiniteScroll.checkVisibleItems === 'function') {
                            infiniteScroll.checkVisibleItems();
                            
                            // 更新调试框
                            if (infiniteScroll.debugMode) {
                                infiniteScroll.updateDebugBoxes();
                            }
                        }
                    }, 50);
                }
            }, 100);
        } catch (error) {
            console.error('渲染网格时出错:', error);
            posterGrid.utils.showError('渲染电视剧网格时发生错误');
        }
    }
}

module.exports = Renderer;