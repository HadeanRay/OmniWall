/**
 * 渲染模块
 */

class Renderer {
    constructor(posterGrid) {
        this.posterGrid = posterGrid;
    }

    /**
 * 创建电视剧卡片元素
 * @param {Object} tvShow - 电视剧数据
 * @returns {HTMLElement} 电视剧卡片元素
 */
createPosterCard(tvShow) {
    const posterGrid = this.posterGrid;
    const card = document.createElement('div');
    card.className = 'poster-card';
    
    const img = document.createElement('img');
    img.className = 'poster-image';
    img.alt = tvShow.name;
    img.loading = 'lazy'; // 添加懒加载属性
    
    // 使用本地缓存的海报路径，如果不存在则使用原始路径
    if (tvShow.localPosterPath) {
        img.src = `file://${tvShow.localPosterPath}`;
    } else if (tvShow.poster) {
        if (tvShow.path) {
            // 本地电视剧使用file://协议
            img.src = `file://${tvShow.poster}`;
        } else {
            // Bangumi海报直接使用URL
            img.src = tvShow.poster;
        }
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
        posterGrid.adjustFontSize(button);
    });
    
    card.addEventListener('click', () => {
        posterGrid.playTvShow(tvShow);
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
            // 清空标题元素
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
                line-height: 1.2; /* 增加行高，避免文字被裁剪 */
            `;
            
            titleElement.appendChild(yearElement);
            titleElement.appendChild(quarterElement);
        } else {
            // 非季度格式，保持原有逻辑
            titleElement.textContent = title;
        }
        
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
            margin: 0 0 20px 0; /* 增加底部空间，避免文字被裁剪 */
            position: relative;
            display: inline-block;
            white-space: nowrap;
            overflow: visible; /* 确保内容不被裁剪 */
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
            height: calc(100% - 80px); /* 增加高度减去的空间，为文字提供更多空间 */
            background: linear-gradient(
                to top, 
                rgba(255, 255, 255, 0) 0%, 
                rgba(255, 255, 255, 0.1) 20%, 
                rgba(255, 255, 255, 0.3) 50%, 
                rgba(255, 255, 255, 0.6) 80%, 
                rgba(255, 255, 255, 0.8) 100%
            );
            z-index: 1; /* 在标题后面 */
            margin-top: 15px; /* 增加在标题下方的空间 */
        `;
        
        groupTitle.appendChild(titleElement);
        groupTitle.appendChild(gradientLine);
        
        return groupTitle;
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
            
            // 应用排序
            const sortedShows = posterGrid.sortTvShows(posterGrid.tvShows);
            
            // 对排序后的电视剧进行分组
            posterGrid.groupedTvShows = posterGrid.groupTvShows(sortedShows);
            
            // 收集所有要渲染的项目（包括分组标题和电视剧卡片）
            let allItemsToRender = [];
            
            // 遍历分组，添加组标题和电视剧卡片
            posterGrid.groupedTvShows.forEach(group => {
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
            
            // 计算每页显示的项目数量（基于当前窗口宽度），以优化性能
            const posterWidth = posterGrid.poster_width || 180;
            const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--poster-gap')) || 12;
            const itemWidth = posterWidth + gap;
            
            // 获取容器宽度
            const containerWidth = posterGrid.container.parentElement ? posterGrid.container.parentElement.clientWidth : window.innerWidth;
            
            // 计算每页显示的项目数（增加一些缓冲区，但不过多）
            const itemsPerPage = Math.ceil(containerWidth / itemWidth) * 2;
            
            // 计算当前页需要渲染的项目范围（虚拟滚动实现）
            const startIndex = 0; // 从第一个开始
            const endIndex = Math.min(startIndex + itemsPerPage * 3, allItemsToRender.length); // 增加缓冲区以确保平滑滚动
            const itemsToRender = allItemsToRender.slice(startIndex, endIndex);
            
            console.log(`虚拟滚动渲染: 总项目数 ${allItemsToRender.length}, 渲染范围 ${startIndex}-${endIndex}`);
            
            // 按顺序渲染当前页项目（横向行、竖列排序）
            itemsToRender.forEach((item, index) => {
                let element;
                
                if (item.type === 'group-title') {
                    // 创建组标题元素
                    element = this.createGroupTitle(item.title);
                } else if (item.type === 'tv-show') {
                    // 创建电视剧卡片元素
                    element = this.createPosterCard(item.data);
                    element.style.border = '2px solid #ffffff';
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
                            originalIndex: startIndex + index // 保存原始索引用于虚拟滚动
                        });
                    }
                }
            });
            
            // 保存总项目信息，用于虚拟滚动计算
            posterGrid.totalItems = allItemsToRender.length;
            posterGrid.allItemsToRender = allItemsToRender;
            posterGrid.itemsPerPage = itemsPerPage;
            posterGrid.currentStartIndex = startIndex;
            posterGrid.currentEndIndex = endIndex;
            
            // 初始化图片位置数据（延迟执行，确保DOM渲染完成）
            setTimeout(() => {
                posterGrid.initImagePositions();
            }, 100);
            
            // 设置虚拟滚动事件监听器（在无限滚动模式下）
            if (posterGrid.gsap) {
                this.setupVirtualScroll();
            } else {
                // 在非无限滚动模式下设置传统的懒加载
                this.setupLazyLoad();
            }
        } catch (error) {
            console.error('渲染网格时出错:', error);
            posterGrid.showError('渲染电视剧网格时发生错误');
        }
    }
    
    /**
     * 设置虚拟滚动事件监听器（在无限滚动模式下使用）
     */
    setupVirtualScroll() {
        const posterGrid = this.posterGrid;
        if (!posterGrid.gsap) return;
        
        // 虚拟滚动的主要实现是在infinite-scroll.js中，这里只是设置一些参数
        console.log('虚拟滚动已设置，总项目数:', posterGrid.totalItems);
    }
    
    /**
     * 设置传统懒加载滚动事件监听器（在非无限滚动模式下使用）
     */
    setupLazyLoad() {
        const posterGrid = this.posterGrid;
        const mainContent = posterGrid.container.parentElement;
        
        if (!mainContent || posterGrid.lazyLoadListener || !posterGrid.allItemsToRender) return;
        
        // 创建防抖函数来避免频繁触发滚动事件
        let scrollTimer;
        const handleScroll = () => {
            if (scrollTimer) {
                clearTimeout(scrollTimer);
            }
            scrollTimer = setTimeout(() => {
                this.checkLazyLoad();
            }, 150); // 增加防抖延迟，减少计算频率
        };
        
        // 添加滚动事件监听器
        mainContent.addEventListener('scroll', handleScroll);
        posterGrid.lazyLoadListener = handleScroll;
    }
    
    /**
     * 检查是否需要加载更多项目（懒加载模式下使用）
     */
    checkLazyLoad() {
        const posterGrid = this.posterGrid;
        const mainContent = posterGrid.container.parentElement;
        
        if (!mainContent || !posterGrid.allItemsToRender) return;
        
        // 检查是否已经加载了所有项目
        if (posterGrid.currentEndIndex >= posterGrid.totalItems) {
            return;
        }
        
        // 检查是否滚动到了容器的末尾附近
        const scrollLeft = mainContent.scrollLeft;
        const scrollWidth = mainContent.scrollWidth;
        const clientWidth = mainContent.clientWidth;
        
        // 如果滚动位置接近末尾（在缓冲区范围内），则加载更多项目
        if (scrollLeft + clientWidth >= scrollWidth - (clientWidth * 0.5)) {
            this.loadMoreItems();
        }
    }
    
    /**
     * 加载更多项目（懒加载模式下使用）
     */
    loadMoreItems() {
        const posterGrid = this.posterGrid;
        if (!posterGrid.allItemsToRender || posterGrid.currentEndIndex >= posterGrid.totalItems) return;
        
        // 计算下一批项目的范围
        const nextStartIndex = posterGrid.currentEndIndex;
        const nextEndIndex = Math.min(nextStartIndex + posterGrid.itemsPerPage, posterGrid.totalItems);
        
        console.log(`懒加载更多项目: 范围 ${nextStartIndex}-${nextEndIndex}`);
        
        // 获取要添加的项目
        const itemsToAdd = posterGrid.allItemsToRender.slice(nextStartIndex, nextEndIndex);
        
        // 渲染新项目
        itemsToAdd.forEach((item, index) => {
            let element;
            
            if (item.type === 'group-title') {
                element = this.createGroupTitle(item.title);
            } else if (item.type === 'tv-show') {
                element = this.createPosterCard(item.data);
                element.style.border = '2px solid #ffffff';
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
                        originalIndex: nextStartIndex + index // 保存原始索引用于虚拟滚动
                    });
                }
            }
        });
        
        // 更新索引
        posterGrid.currentStartIndex = nextStartIndex;
        posterGrid.currentEndIndex = nextEndIndex;
        
        // 重新初始化图片位置数据
        setTimeout(() => {
            posterGrid.initImagePositions();
        }, 100);
    }
}

module.exports = Renderer;