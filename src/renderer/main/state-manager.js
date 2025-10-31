(function() {
    
class StateManager {
    constructor() {
        this.ipcRenderer = require('electron').ipcRenderer;
        this.currentState = {
            tvShows: [],
            isLoading: true,
            error: null,
            isEmpty: false,
            sortType: 'name-asc' // 默认按名称升序排序
        };
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.ipcRenderer.on('tv-shows-scanned', (event, data) => {
            this.handleTvShowsData(data);
        });

        // 设置页面加载后处理空状态按钮
        document.addEventListener('DOMContentLoaded', () => {
            const setupBtn = document.getElementById('setup-btn');
            if (setupBtn) {
                setupBtn.addEventListener('click', () => {
                    this.openSettings();
                });
            }
        });
    }

    openSettings() {
        this.ipcRenderer.send('open-settings');
    }

    handleTvShowsData(data) {
        if (data.error) {
            this.updateState({
                tvShows: [],
                isLoading: false,
                error: data.error,
                isEmpty: false
            });
        } else {
            const tvShows = data.tvShows || [];
            this.updateState({
                tvShows: this.sortTvShows(tvShows),
                isLoading: false,
                error: null,
                isEmpty: tvShows.length === 0
            });
        }
    }

    updateState(newState) {
        const oldState = { ...this.currentState };
        this.currentState = { ...this.currentState, ...newState };
        
        // 触发状态变化事件
        this.notifyStateChange(oldState, this.currentState);
    }

    notifyStateChange(oldState, newState) {
        // 这里可以添加状态变化时的回调处理
        // 例如：更新UI组件、触发重新渲染等
        const event = new CustomEvent('state-changed', {
            detail: {
                oldState,
                newState
            }
        });
        document.dispatchEvent(event);
    }

    getState() {
        return { ...this.currentState };
    }

    getTvShows() {
        return [...this.currentState.tvShows];
    }

    isLoading() {
        return this.currentState.isLoading;
    }

    hasError() {
        return this.currentState.error !== null;
    }

    getError() {
        return this.currentState.error;
    }

    isEmpty() {
        return this.currentState.isEmpty;
    }

    // 扫描电视剧
    scanTvShows() {
        this.updateState({
            isLoading: true,
            error: null,
            isEmpty: false
        });
        this.ipcRenderer.send('scan-tv-shows');
    }

    // 设置排序方式
    setSortType(sortType) {
        this.updateState({
            sortType: sortType,
            tvShows: this.sortTvShows(this.currentState.tvShows, sortType)
        });
    }

    // 排序电视剧列表
    sortTvShows(tvShows, sortType = this.currentState.sortType) {
        if (!tvShows || tvShows.length === 0) return tvShows;

        const sortedShows = [...tvShows]; // 创建副本避免修改原数组

        switch (sortType) {
            case 'name-asc':
                return sortedShows.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
            
            case 'name-desc':
                return sortedShows.sort((a, b) => b.name.localeCompare(a.name, 'zh-CN'));
            
            case 'date-asc':
                // 按修改时间升序 (旧→新)
                return sortedShows.sort((a, b) => {
                    const timeA = this.getTvShowModifyTime(a);
                    const timeB = this.getTvShowModifyTime(b);
                    return timeA - timeB;
                });
            
            case 'date-desc':
                // 按修改时间降序 (新→旧)
                return sortedShows.sort((a, b) => {
                    const timeA = this.getTvShowModifyTime(a);
                    const timeB = this.getTvShowModifyTime(b);
                    return timeB - timeA;
                });
            
            case 'seasons-asc':
                // 按季数升序 (少→多)
                return sortedShows.sort((a, b) => {
                    const seasonsA = this.getTvShowSeasonsCount(a);
                    const seasonsB = this.getTvShowSeasonsCount(b);
                    return seasonsA - seasonsB;
                });
            
            case 'seasons-desc':
                // 按季数降序 (多→少)
                return sortedShows.sort((a, b) => {
                    const seasonsA = this.getTvShowSeasonsCount(a);
                    const seasonsB = this.getTvShowSeasonsCount(b);
                    return seasonsB - seasonsA;
                });
            
            default:
                return sortedShows;
        }
    }

    // 获取电视剧的修改时间（使用第一集的修改时间作为参考）
    getTvShowModifyTime(tvShow) {
        if (tvShow.firstEpisode && tvShow.firstEpisode.modifiedTime) {
            return new Date(tvShow.firstEpisode.modifiedTime).getTime();
        }
        return 0;
    }

    // 获取电视剧的季数
    getTvShowSeasonsCount(tvShow) {
        if (tvShow.seasons && Array.isArray(tvShow.seasons)) {
            return tvShow.seasons.length;
        }
        return 0;
    }

    // 重置状态
    reset() {
        this.updateState({
            tvShows: [],
            isLoading: true,
            error: null,
            isEmpty: false,
            sortType: 'name-asc'
        });
    }

    destroy() {
        // 清理事件监听器
        this.ipcRenderer.removeAllListeners('tv-shows-scanned');
    }
}

module.exports = StateManager;

})();