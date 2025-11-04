/**
 * 工具函数模块
 */

class Utils {
    constructor(posterGrid) {
        this.posterGrid = posterGrid;
    }

    /**
     * 获取中文字符的拼音首字母
     * @param {string} str - 中文字符串
     * @returns {string} 拼音首字母
     */
    getPinyinFirstLetter(str) {
        // 导入pinyin库用于处理中文字符到拼音的转换
        const pinyinLib = require('pinyin');
        
        if (!str || str.length === 0) return '#';
        
        const firstChar = str.charAt(0);
        
        // 如果是英文字母，直接返回大写
        if (/[a-zA-Z]/.test(firstChar)) {
            return firstChar.toUpperCase();
        }
        
        // 如果是数字，归为#组
        if (/\d/.test(firstChar)) {
            return '#';
        }
        
        // 如果是中文，使用pinyin库获取拼音首字母
        if (/[一-龥]/.test(firstChar)) {
            try {
                // 使用pinyin库获取拼音，设置样式为拼音首字母
                const pinyinResult = pinyinLib.default(firstChar, {
                    style: pinyinLib.default.STYLE_FIRST_LETTER, // 只获取首字母
                    heteronym: false // 不获取多音字
                });
                
                // 获取结果并转为大写
                if (pinyinResult && pinyinResult[0] && pinyinResult[0][0]) {
                    return pinyinResult[0][0].toUpperCase();
                }
            } catch (error) {
                console.error('获取拼音首字母时出错:', error);
            }
            return '#'; // 如果转换失败，归为#组
        }
        
        // 其他字符归为#组
        return '#';
    }

    /**
     * 自动调整按钮字体大小以适应容器宽度
     * @param {HTMLElement} button - 要调整字体大小的按钮元素
     */
    adjustFontSize(button) {
        const posterGrid = this.posterGrid;
        // 确保元素已经添加到DOM中
        if (!button || !button.parentNode) return;
        
        // 获取按钮的计算样式
        const computedStyle = window.getComputedStyle(button);
        const buttonWidth = button.clientWidth - 
            parseFloat(computedStyle.paddingLeft) - 
            parseFloat(computedStyle.paddingRight);
        const buttonHeight = button.clientHeight - 
            parseFloat(computedStyle.paddingTop) - 
            parseFloat(computedStyle.paddingBottom);
        
        // 获取文本内容
        const text = button.textContent || button.innerText;
        if (!text) return;
        
        // 创建一个临时div元素来测量文本尺寸
        const tempDiv = document.createElement('div');
        tempDiv.style.fontSize = computedStyle.fontSize;
        tempDiv.style.fontFamily = computedStyle.fontFamily;
        tempDiv.style.fontWeight = computedStyle.fontWeight;
        tempDiv.style.visibility = 'hidden';
        tempDiv.style.position = 'absolute';
        tempDiv.style.whiteSpace = 'normal';
        tempDiv.style.wordWrap = 'break-word';
        tempDiv.style.textAlign = 'center';
        tempDiv.style.width = buttonWidth + 'px';
        tempDiv.style.lineHeight = computedStyle.lineHeight;
        tempDiv.textContent = text;
        
        document.body.appendChild(tempDiv);
        
        // 获取当前字体大小
        let fontSize = parseFloat(computedStyle.fontSize);
        const originalFontSize = fontSize;
        const minHeight = 8; // 最小字体大小
        
        // 如果文本高度超出按钮高度，则减小字体大小
        while (tempDiv.offsetHeight > buttonHeight && fontSize > minHeight) {
            fontSize -= 0.5;
            tempDiv.style.fontSize = fontSize + 'px';
        }
        
        // 如果文本高度远小于按钮高度且字体大小小于原始大小，则增大字体大小
        while (tempDiv.offsetHeight < buttonHeight * 0.8 && fontSize < originalFontSize) {
            fontSize += 0.5;
            tempDiv.style.fontSize = fontSize + 'px';
            
            // 如果增大后超出了按钮高度，则停止增大
            if (tempDiv.offsetHeight > buttonHeight) {
                fontSize -= 0.5;
                tempDiv.style.fontSize = fontSize + 'px';
                break;
            }
        }
        
        // 应用新的字体大小
        button.style.fontSize = fontSize + 'px';
        
        // 清理临时元素
        document.body.removeChild(tempDiv);
    }

    /**
     * 显示错误信息
     * @param {string} message - 错误消息
     */
    showError(message) {
        try {
            const loading = document.getElementById('loading');
            const error = document.getElementById('error');
            
            if (loading) loading.style.display = 'none';
            if (error) {
                error.style.display = 'block';
                error.textContent = message;
            }
        } catch (err) {
            console.error('显示错误信息时出错:', err);
        }
    }

    /**
     * 显示空状态
     */
    showEmptyState() {
        try {
            const loading = document.getElementById('loading');
            const empty = document.getElementById('empty');
            
            if (loading) loading.style.display = 'none';
            if (empty) empty.style.display = 'block';
        } catch (err) {
            console.error('显示空状态时出错:', err);
        }
    }

    /**
     * 隐藏加载状态
     */
    hideLoading() {
        try {
            const loading = document.getElementById('loading');
            if (loading) loading.style.display = 'none';
        } catch (err) {
            console.error('隐藏加载状态时出错:', err);
        }
    }

    /**
     * 播放电视剧
     * @param {Object} tvShow - 电视剧对象
     */
    playTvShow(tvShow) {
        const posterGrid = this.posterGrid;
        const { ipcRenderer } = require('electron');
        
        
        
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

    /**
     * 获取电视剧的最后播放信息
     * @param {string} tvShowPath - 电视剧路径
     * @returns {Promise} 包含最后播放信息的Promise
     */
    getLastPlayedInfo(tvShowPath) {
        return new Promise((resolve) => {
            const { ipcRenderer } = require('electron');
            
            // 发送请求获取最后播放记录
            ipcRenderer.send('get-last-played', { tvShowPath });
            
            // 监听返回结果
            ipcRenderer.once('last-played-loaded', (event, data) => {
                resolve(data.lastPlayed);
            });
        });
    }

    /**
     * 更新卡片背面的最后播放信息
     * @param {HTMLElement} card - 海报卡片元素
     * @param {string} tvShowPath - 电视剧路径
     */
    async updateLastPlayedInfo(card, tvShowPath) {
        try {
            const lastPlayed = await this.getLastPlayedInfo(tvShowPath);
            const lastPlayedInfo = card.querySelector('.last-played-info');
            
            if (lastPlayedInfo && lastPlayed) {
                // 格式化显示信息为 S几E几
                lastPlayedInfo.textContent = `S${lastPlayed.season}E${lastPlayed.episode}`;
            } else if (lastPlayedInfo) {
                // 如果没有最后播放记录，显示默认信息
                lastPlayedInfo.textContent = 'S0E0';
            }
        } catch (error) {
            console.error('更新最后播放信息失败:', error);
        }
    }

    handleTvShowsScanned(data) {
        const posterGrid = this.posterGrid;
        try {
            const loading = document.getElementById('loading');
            const error = document.getElementById('error');
            const empty = document.getElementById('empty');
            
            if (data.error) {
                this.showError(data.error);
                return;
            }
            
            posterGrid.tvShows = data.tvShows || [];
            
            if (posterGrid.tvShows.length === 0) {
                this.showEmptyState();
                return;
            }
            
            this.hideLoading();
            posterGrid.updatePosterSize(); // 确保渲染前尺寸正确
            
            // 使用预计算的骨架屏结构更新网格
            if (posterGrid.renderer && typeof posterGrid.renderer.precomputeSkeletonStructure === 'function') {

                const skeletonStructure = posterGrid.renderer.precomputeSkeletonStructure();

            }
            posterGrid.renderGrid();
        } catch (error) {
            console.error('处理电视剧扫描结果时出错:', error);
            this.showError('处理电视剧数据时发生错误');
        }
    }

    handleSortChange(sortType) {
        const posterGrid = this.posterGrid;
        try {
            console.log('排序方式改变:', sortType);
            posterGrid.currentSortType = sortType;
            
            // 清除缓存的循环距离，因为排序改变会导致布局变化
            if (posterGrid.cachedCycleDistance) {
                posterGrid.cachedCycleDistance = null;
                
            }
            
            // 重新渲染网格以应用新的排序
            if (posterGrid.tvShows && posterGrid.tvShows.length > 0) {
                // 在重新渲染前预计算完整的骨架屏结构
                if (posterGrid.renderer && typeof posterGrid.renderer.precomputeSkeletonStructure === 'function') {
                    
                    const skeletonStructure = posterGrid.renderer.precomputeSkeletonStructure();
                    
                }
                posterGrid.renderGrid();
            }
        } catch (error) {
            console.error('处理排序变化时出错:', error);
        }
    }
}

module.exports = Utils;