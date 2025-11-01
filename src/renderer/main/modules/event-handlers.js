/**
 * 事件处理模块
 */

class EventHandlers {
    constructor(posterGrid) {
        this.posterGrid = posterGrid;
    }

    setupEventListeners() {
        const posterGrid = this.posterGrid;
        // 监听电视剧扫描结果
        const { ipcRenderer } = require('electron');
        ipcRenderer.on('tv-shows-scanned', (event, data) => {
            posterGrid.handleTvShowsScanned(data);
        });

        // 监听排序变化事件
        document.addEventListener('sort-changed', (event) => {
            posterGrid.handleSortChange(event.detail.sortType);
        });
    }

    setupResizeListener() {
        const posterGrid = this.posterGrid;
        // 监听窗口大小变化，调整海报尺寸
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                posterGrid.updatePosterSize();
                // 如果已经有渲染的网格，重新渲染以更新布局
                if (posterGrid.tvShows.length > 0) {
                    posterGrid.renderGrid();
                }
            }, 100);
        });
    }
}

module.exports = EventHandlers;