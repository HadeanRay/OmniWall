(function() {
    
class PosterGrid {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.tvShows = [];
        this.optimalRows = 2; // 默认2行
        this.scrollAnimationId = null;
        this.init();
    }

    init() {
        if (!this.container) {
            console.error('海报网格容器未找到:', this.containerId);
            return;
        }
        this.setupEventListeners();
        this.setupResizeListener();
        this.setupWheelListener(); // 添加滚轮事件监听
        this.updatePosterSize(); // 初始化尺寸
    }

    setupEventListeners() {
        // 监听电视剧扫描结果
        const { ipcRenderer } = require('electron');
        ipcRenderer.on('tv-shows-scanned', (event, data) => {
            this.handleTvShowsScanned(data);
        });
    }

    setupResizeListener() {
        // 监听窗口大小变化，调整海报尺寸
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.updatePosterSize();
                // 如果已经有渲染的网格，重新渲染以更新布局
                if (this.tvShows.length > 0) {
                    this.renderGrid();
                }
            }, 100);
        });
    }

    setupWheelListener() {
        // 监听鼠标滚轮事件，实现平滑横向滚动
        this.container.addEventListener('wheel', (event) => {
            // 防止默认的垂直滚动行为
            event.preventDefault();
            
            // 获取滚动容器
            const scrollContainer = this.container.parentElement;
            if (!scrollContainer) return;
            
            // 简化滚动逻辑，直接使用deltaY值进行滚动
            const scrollAmount = event.deltaY * 1.5; // 稍微增加滚动灵敏度
            
            // 平滑滚动实现
            this.smoothScroll(scrollContainer, scrollAmount);
            
        }, { passive: false }); // 必须设置为非被动事件，才能调用 preventDefault()
    }

    smoothScroll(scrollContainer, deltaX) {
        // 如果已经有滚动动画在进行，先停止它
        if (this.scrollAnimationId) {
            cancelAnimationFrame(this.scrollAnimationId);
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
            this.scrollAnimationId = null;
            return;
        }
        
        // 缓动函数：easeOutCubic
        const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
        
        // 动画时长（毫秒）- 根据滚动距离调整
        const baseDuration = 200;
        const scrollDistance = Math.abs(deltaX);
        const duration = Math.min(baseDuration + scrollDistance * 0.05, 500); // 减少最大时长
        
        const animateScroll = (currentTime) => {
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
                this.scrollAnimationId = requestAnimationFrame(animateScroll);
            } else {
                this.scrollAnimationId = null;
            }
        };
        
        // 启动动画
        this.scrollAnimationId = requestAnimationFrame(animateScroll);
    }

    // 移除惯性滚动功能，简化滚动逻辑

    updatePosterSize() {
        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth;
        
        // 计算最大允许的行数（最多5行）
        const maxRows = 5;
        const minHeight = 240;
        const maxHeight = 600; // 进一步增加最大高度限制，让海报更大
        const minGap = 12;
        
        // 计算每行最小需要的高度（海报高度 + 行间距）
        const rowGap = minGap;
        const minRowHeight = minHeight + rowGap;
        
        // 计算海报高度，考虑垂直居中布局
        // 主内容区使用align-items: center，不需要减去主内容区的padding
        const posterGridPadding = 60; 
        
        // 计算可用高度（只减去海报网格的padding）
        const availableHeight = windowHeight - posterGridPadding * 2;
        
        // 计算最大行数
        const maxPossibleRows = Math.floor(availableHeight / (minHeight + rowGap));
        const optimalRows = Math.min(maxRows, Math.max(2, maxPossibleRows));
        
        // 根据可用高度和行数计算海报高度（精确考虑行间距）
        const totalRowGap = rowGap * (optimalRows - 1); // 总行间距
        const baseHeight = Math.max(minHeight, Math.min(maxHeight, (availableHeight - totalRowGap) / optimalRows));
        const baseWidth = baseHeight * 0.64; // 保持1:1.56的宽高比
        
        // 列间距只与海报宽度相关（海报宽度的20%）
        const maxGap = 20;
        const baseGap = Math.max(minGap, Math.min(maxGap, baseWidth * 0.2));
        
        // 设置CSS变量
        document.documentElement.style.setProperty('--poster-height', `${baseHeight}px`);
        document.documentElement.style.setProperty('--poster-width', `${baseWidth}px`);
        document.documentElement.style.setProperty('--poster-gap', `${baseGap}px`);
        document.documentElement.style.setProperty('--grid-rows', `${optimalRows}`);
        
        // 保存行数信息
        this.optimalRows = optimalRows;
        
        console.log(`窗口尺寸: ${windowWidth}x${windowHeight}, 海报网格Padding: ${posterGridPadding}px, 可用高度: ${availableHeight}px, 最大可能行数: ${maxPossibleRows}, 最优行数: ${optimalRows}, 海报尺寸: ${Math.round(baseWidth)}x${Math.round(baseHeight)}, 间距: ${Math.round(baseGap)}px`);
        
        // 更新调试信息
        this.updateDebugInfo();
    }

    updateDebugInfo() {
        const debugDiv = document.getElementById('grid-debug-info');
        if (debugDiv && this.container) {
            debugDiv.innerHTML = `
                <div>Grid Debug Info:</div>
                <div>总卡片数: ${this.tvShows.length}</div>
                <div>行数: ${this.optimalRows || 2}</div>
                <div>窗口尺寸: ${window.innerWidth}x${window.innerHeight}</div>
                <div>容器宽: ${this.container.clientWidth}px</div>
                <div>容器高: ${this.container.clientHeight}px</div>
                <div>海报宽: ${getComputedStyle(document.documentElement).getPropertyValue('--poster-width')}</div>
                <div>海报高: ${getComputedStyle(document.documentElement).getPropertyValue('--poster-height')}</div>
                <div>间距: ${getComputedStyle(document.documentElement).getPropertyValue('--poster-gap')}</div>
                <div>CSS Grid: grid-auto-flow: row; grid-template-columns: repeat(auto-fill, var(--poster-width));</div>
            `;
        }
    }

    handleTvShowsScanned(data) {
        const loading = document.getElementById('loading');
        const error = document.getElementById('error');
        const empty = document.getElementById('empty');
        
        if (data.error) {
            this.showError(data.error);
            return;
        }
        
        this.tvShows = data.tvShows || [];
        
        if (this.tvShows.length === 0) {
            this.showEmptyState();
            return;
        }
        
        this.hideLoading();
        this.updatePosterSize(); // 确保渲染前尺寸正确
        this.renderGrid();
    }

    showError(message) {
        const loading = document.getElementById('loading');
        const error = document.getElementById('error');
        
        if (loading) loading.style.display = 'none';
        if (error) {
            error.style.display = 'block';
            error.textContent = message;
        }
    }

    showEmptyState() {
        const loading = document.getElementById('loading');
        const empty = document.getElementById('empty');
        
        if (loading) loading.style.display = 'none';
        if (empty) empty.style.display = 'block';
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) loading.style.display = 'none';
    }

    renderGrid() {
        this.container.style.display = 'grid';
        this.container.innerHTML = '';
        
        // 确保行数已计算，如果没有则使用默认2行
        const rows = this.optimalRows || 2;
        
        // 根据行数将电视剧分成多行
        const itemsPerRow = Math.ceil(this.tvShows.length / rows);
        const rowsData = [];
        
        for (let i = 0; i < rows; i++) {
            const startIndex = i * itemsPerRow;
            const endIndex = Math.min(startIndex + itemsPerRow, this.tvShows.length);
            rowsData.push(this.tvShows.slice(startIndex, endIndex));
        }
        
        // 定义测试颜色数组
        const testColors = [
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7',
            '#dda0dd', '#98d8c8', '#f7dc6f', '#bb8fce', '#85c1e9',
            '#f8c471', '#82e0aa', '#f1948a', '#85c1e9', '#d7bde2',
            '#aed6f1', '#f9e79f', '#abebc6', '#fad7a0', '#e8daef'
        ];
        
        console.log(`渲染网格，总电视剧数: ${this.tvShows.length}, 行数: ${rows}, 每行最多: ${itemsPerRow}个`);
        console.log(`容器尺寸: ${this.container.clientWidth}x${this.container.clientHeight}`);
        console.log(`CSS变量: --poster-width: ${getComputedStyle(document.documentElement).getPropertyValue('--poster-width')}, --poster-height: ${getComputedStyle(document.documentElement).getPropertyValue('--poster-height')}, --poster-gap: ${getComputedStyle(document.documentElement).getPropertyValue('--poster-gap')}`);
        
        // 渲染所有行
        rowsData.forEach((row, rowIndex) => {
            row.forEach((tvShow, index) => {
                const card = this.createPosterCard(tvShow);
                // 为每个卡片添加测试颜色和调试信息
                card.style.backgroundColor = testColors[(rowIndex * itemsPerRow + index) % testColors.length];
                card.style.border = '2px solid #ffffff';
                card.style.position = 'relative';
                
                // 添加调试信息
                const debugInfo = document.createElement('div');
                debugInfo.style.cssText = `
                    position: absolute;
                    top: 5px;
                    left: 5px;
                    background: rgba(0,0,0,0.8);
                    color: white;
                    padding: 2px 4px;
                    font-size: 10px;
                    border-radius: 3px;
                    z-index: 10;
                `;
                debugInfo.textContent = `R${rowIndex+1}-${index+1}`;
                card.appendChild(debugInfo);
                
                this.container.appendChild(card);
            });
        });
        
        // 添加网格调试信息
        let debugDiv = document.getElementById('grid-debug-info');
        if (!debugDiv) {
            debugDiv = document.createElement('div');
            debugDiv.id = 'grid-debug-info';
            debugDiv.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: rgba(0,0,0,0.9);
                color: white;
                padding: 10px;
                border-radius: 5px;
                font-family: monospace;
                font-size: 12px;
                z-index: 1000;
                border: 1px solid #666;
            `;
            document.body.appendChild(debugDiv);
        }
        
        this.updateDebugInfo();
    }

    createPosterCard(tvShow) {
        const card = document.createElement('div');
        card.className = 'poster-card';
        
        const img = document.createElement('img');
        img.className = 'poster-image';
        img.alt = tvShow.name;
        
        if (tvShow.poster) {
            img.src = `file://${tvShow.poster}`;
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
        
        card.addEventListener('click', () => {
            this.playTvShow(tvShow);
        });
        
        card.appendChild(img);
        card.appendChild(button);
        
        return card;
    }

    playTvShow(tvShow) {
        const { ipcRenderer } = require('electron');
        
        console.log('点击电视剧:', tvShow.name);
        console.log('路径:', tvShow.path);
        console.log('第一集路径:', tvShow.firstEpisode);
        
        if (tvShow.firstEpisode) {
            ipcRenderer.send('play-tv-show', {
                name: tvShow.name,
                path: tvShow.path,
                firstEpisode: tvShow.firstEpisode
            });
        } else {
            alert(`未找到 ${tvShow.name} 的第一季第一集视频文件`);
        }
    }

    updateTvShows(tvShows) {
        this.tvShows = tvShows;
        this.renderGrid();
    }

    clear() {
        this.tvShows = [];
        this.container.innerHTML = '';
        
        const loading = document.getElementById('loading');
        const error = document.getElementById('error');
        const empty = document.getElementById('empty');
        
        if (loading) loading.style.display = 'block';
        if (error) error.style.display = 'none';
        if (empty) empty.style.display = 'none';
    }

    destroy() {
        // 清理所有动画和定时器
        if (this.scrollAnimationId) {
            cancelAnimationFrame(this.scrollAnimationId);
            this.scrollAnimationId = null;
        }
        
        this.container.innerHTML = '';
        this.tvShows = [];
    }
}

module.exports = PosterGrid;

})();