(function() {
    
class PosterGrid {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.tvShows = [];
        this.init();
    }

    init() {
        if (!this.container) {
            console.error('海报网格容器未找到:', this.containerId);
            return;
        }
        this.setupEventListeners();
    }

    setupEventListeners() {
        // 监听电视剧扫描结果
        const { ipcRenderer } = require('electron');
        ipcRenderer.on('tv-shows-scanned', (event, data) => {
            this.handleTvShowsScanned(data);
        });
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
        
        this.tvShows.forEach(tvShow => {
            const card = this.createPosterCard(tvShow);
            this.container.appendChild(card);
        });
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
        this.container.innerHTML = '';
        this.tvShows = [];
    }
}

module.exports = PosterGrid;

})();