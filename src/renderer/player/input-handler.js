class InputHandler {
    constructor(playerController) {
        this.playerController = playerController;
        this.controlsTimeout = null;
        
        this.initialize();
    }

    initialize() {
        // 绑定键盘事件
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
        
        // 绑定鼠标移动事件
        document.addEventListener('mousemove', () => this.handleMouseMove());
        
        // 初始化时显示控制条3秒后自动隐藏
        setTimeout(() => {
            this.hideControls();
        }, 3000);
        
        console.log('输入处理器初始化完成');
    }

    // 自动隐藏控制条
    hideControls() {
        const controls = document.querySelector('.floating-controls');
        const tvShowTitle = document.getElementById('tvShowTitle');
        if (controls) {
            controls.style.opacity = '0';
        }
        if (tvShowTitle) {
            tvShowTitle.style.opacity = '0';
        }
    }

    showControls() {
        const controls = document.querySelector('.floating-controls');
        const tvShowTitle = document.getElementById('tvShowTitle');
        if (controls) {
            controls.style.opacity = '1';
        }
        if (tvShowTitle) {
            tvShowTitle.style.opacity = '1';
        }
        
        // 清除之前的计时器
        clearTimeout(this.controlsTimeout);
        
        // 3秒后自动隐藏控制条和标题
        this.controlsTimeout = setTimeout(() => {
            this.hideControls();
        }, 3000);
    }

    // 鼠标移动事件处理函数
    handleMouseMove() {
        this.showControls();
    }

    // 键盘事件处理函数
    handleKeydown(e) {
        switch (e.key) {
            case ' ':
            case 'Space':
                e.preventDefault();
                this.playerController.playPause();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (e.ctrlKey) {
                    this.playerController.prevEpisode();
                } else {
                    this.playerController.rewind();
                }
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (e.ctrlKey) {
                    this.playerController.nextEpisode();
                } else {
                    this.playerController.fastForward();
                }
                break;
            case 'Escape':
                if (document.fullscreenElement) {
                    this.playerController.toggleFullscreen();
                }
                break;
            case 'f':
            case 'F':
                if (e.ctrlKey) {
                    e.preventDefault();
                    this.playerController.toggleFullscreen();
                }
                break;
            case 'm':
            case 'M':
                e.preventDefault();
                this.playerController.toggleMute();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.playerController.setVolume(Math.min(this.playerController.videoPlayer.volume + 0.1, 1));
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.playerController.setVolume(Math.max(this.playerController.videoPlayer.volume - 0.1, 0));
                break;
            case 's':
            case 'S':
                if (e.ctrlKey) {
                    e.preventDefault();
                    if (window.playerManager && window.playerManager.subtitleManager) {
                        window.playerManager.subtitleManager.toggleSubtitleMenu();
                    }
                }
                break;
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
                if (e.ctrlKey) {
                    e.preventDefault();
                    if (this.playerController) {
                        this.playerController.handleSpeedShortcut(e.key);
                    }
                }
                break;
        }
    }

    // 清理方法
    cleanup() {
        console.log('清理输入处理器资源...');
        
        // 清除定时器
        if (this.controlsTimeout) {
            clearTimeout(this.controlsTimeout);
            this.controlsTimeout = null;
        }
        
        // 移除事件监听器
        document.removeEventListener('keydown', this.handleKeydown);
        document.removeEventListener('mousemove', this.handleMouseMove);
        
        console.log('输入处理器资源清理完成');
    }
}

// 导出类供其他模块使用
module.exports = InputHandler;