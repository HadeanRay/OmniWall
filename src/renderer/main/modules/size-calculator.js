/**
 * 尺寸计算模块 - 支持扁平化数据结构
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
                posterGrid.container_width = mainContent.clientWidth;
                posterGrid.container_height = mainContentHeight;
                posterGrid.poster_width = baseWidth;
                posterGrid.poster_height = baseHeight;
                posterGrid.scale_nums = window.innerWidth / posterGrid.standard_width;
            }
            
            // 重新初始化位置以填满新尺寸
            if (posterGrid.renderer && posterGrid.renderer.flatElements && posterGrid.renderer.flatElements.length > 0) {
                this.initImagePositions();
            }
        } catch (error) {
            console.error('更新海报尺寸时出错:', error);
        }
    }

    /**
     * 初始化图片位置数据（使用扁平化结构）
     */
    initImagePositions() {
        const posterGrid = this.posterGrid;
        const renderer = posterGrid.renderer;
        if (!renderer || !renderer.flatElements || renderer.flatElements.length === 0) return;
        
        // 更新容器的总宽度，以便滚动边界计算
        if (renderer.flatElements.length > 0) {
            // 找到最后一个元素的右边界
            const lastElement = renderer.flatElements[renderer.flatElements.length - 1];
            const containerWidth = lastElement.x + (lastElement.type === 'header' ? posterGrid.poster_width / 2 : posterGrid.poster_width);
            posterGrid.container.style.width = `${containerWidth}px`;
        }
        
        // 重新计算可见元素位置
        if (posterGrid.infiniteScroll) {
            posterGrid.infiniteScroll.updateElementPositions();
        }
    }
}

module.exports = SizeCalculator;