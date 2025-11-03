/**
 * 尺寸计算模块
 */

class SizeCalculator {
    constructor(posterGrid) {
        this.posterGrid = posterGrid;
    }

    /**
     * 更新海报尺寸以适应窗口大小
     */
    updatePosterSize() {
        const posterGrid = this.posterGrid;
        try {
            // 获取main-content的实际尺寸
            const mainContent = posterGrid.container?.parentElement;
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
            
            // 计算可用高度（基于main-content的实际高度）
            const availableHeight = mainContentHeight - 320; // 减去顶部padding
            
            // 计算最大行数
            const maxPossibleRows = Math.floor(availableHeight / (minHeight + rowGap));
            const optimalRows = Math.min(maxRows, Math.max(2, maxPossibleRows));
            
            // 根据可用高度和行数计算海报高度
            const totalRowGap = rowGap * (optimalRows - 1);
            const baseHeight = Math.max(minHeight, Math.min(maxHeight, (availableHeight - totalRowGap) / optimalRows));
            const baseWidth = baseHeight * 0.5625; // 保持9:16的宽高比 (9/16 = 0.5625)
            
            // 列间距只与海报宽度相关
            const maxGap = 20;
            const baseGap = Math.max(minGap, Math.min(maxGap, baseWidth * 0.2));
            
            // 设置CSS变量
            document.documentElement.style.setProperty('--poster-height', `${baseHeight}px`);
            document.documentElement.style.setProperty('--poster-width', `${baseWidth}px`);
            document.documentElement.style.setProperty('--poster-gap', `${baseGap}px`);
            document.documentElement.style.setProperty('--grid-rows', `${optimalRows}`);
            
            // 保存行数信息
            posterGrid.optimalRows = optimalRows;
            
            // 更新无限滑动相关尺寸
            if (posterGrid.container) {
                posterGrid.container_width = mainContentWidth;
                posterGrid.container_height = mainContentHeight;
                posterGrid.poster_width = baseWidth;
                posterGrid.poster_height = baseHeight;
                posterGrid.scale_nums = window.innerWidth / posterGrid.standard_width;
            }
            
            console.log(`main-content尺寸: ${mainContentWidth}x${mainContentHeight}, 最优行数: ${optimalRows}, 海报尺寸: ${Math.round(baseWidth)}x${Math.round(baseHeight)}, 间距: ${Math.round(baseGap)}px`);
            
            // 重新初始化位置以填满新尺寸
            if (posterGrid.img_data && posterGrid.img_data.length > 0) {
                this.initImagePositions();
            }
        } catch (error) {
            console.error('更新海报尺寸时出错:', error);
        }
    }

    /**
     * 分析图片数据以确定列布局
     * @returns {Array} 列布局信息数组
     */
    analyzeColumnLayout() {
        const posterGrid = this.posterGrid;
        const columnLayout = []; // 存储每列的元素信息
        let currentColumn = { type: null, count: 0, items: [] };
        
        // 分析img_data以确定每列的布局
        for (let i = 0; i < posterGrid.img_data.length; i++) {
            const img = posterGrid.img_data[i];
            
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
        
        return columnLayout;
    }

    /**
     * 计算列数
     * @param {Array} columnLayout - 列布局信息
     * @returns {Object} 包含组标题列数和海报列数的对象
     */
    calculateColumnCounts(columnLayout) {
        const posterGrid = this.posterGrid;
        let groupTitleCols = 0;
        let posterCols = 0;
        const maxRows = posterGrid.optimalRows || 2;
        
        // 计算各类型列的数量
        for (const column of columnLayout) {
            if (column.type === 'group-title') {
                // 每个组标题占据一列（现在宽度为原来的一半）
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
        
        return { groupTitleCols, posterCols };
    }

    /**
     * 初始化图片位置数据
     */
    initImagePositions() {
        const posterGrid = this.posterGrid;
        if (!posterGrid.gsap || !posterGrid.img_data.length) return;
        
        console.log('初始化图片位置，海报数量:', posterGrid.img_data.length);
        
        // 获取容器的实际尺寸
        const containerRect = posterGrid.container.getBoundingClientRect();
        const posterWidth = posterGrid.poster_width;
        const posterHeight = posterGrid.poster_height;
        const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--poster-gap')) || 12;
        
        // 获取main-content的实际尺寸
        const mainContent = posterGrid.container.parentElement;
        if (!mainContent) return;
        
        // 计算main-content的可用空间
        const mainContentWidth = mainContent.clientWidth;
        const mainContentHeight = mainContent.clientHeight - 40; // 减去顶部padding
        
        // 计算最优的卡片布局 - 横向行、竖列排序
        const maxRows = posterGrid.optimalRows || 2;
        
        // 计算垂直居中对齐
        const totalCardsHeight = maxRows * (posterHeight + gap) - gap;
        const verticalOffset = Math.max(0, (mainContentHeight - totalCardsHeight) / 2);
        
        // 分析列布局
        const columnLayout = this.analyzeColumnLayout();
        
        // 现在根据列布局设置每个元素的位置
        let totalXOffset = -posterWidth; // 从左侧开始
        
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
                    if (posterGrid.gsap) {
                        posterGrid.gsap.set(img.node, {
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
                    if (posterGrid.gsap) {
                        posterGrid.gsap.set(img.node, {
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
        if (posterGrid.gsap && posterGrid.container.classList.contains('infinite-scroll')) {
            // 设置容器尺寸为main-content的完整尺寸，实现填满效果
            posterGrid.container.style.width = mainContentWidth + 'px';
            posterGrid.container.style.height = mainContentHeight + 'px';
            
            console.log('填满main-content区域，尺寸:', mainContentWidth, 'x', mainContentHeight);
            console.log('卡片布局:', Math.floor(mainContentWidth / (posterWidth + gap)), '列 x', maxRows, '行');
            
            // 更新调试框位置
            if (posterGrid.infiniteScroll && posterGrid.infiniteScroll.debugMode) {
                posterGrid.infiniteScroll.updateDebugBoxes();
            }
        } else {
            // 普通网格模式下，让CSS Grid自动处理布局
            posterGrid.container.style.width = '100%';
            posterGrid.container.style.height = '100%';
        }
    }
}

module.exports = SizeCalculator;