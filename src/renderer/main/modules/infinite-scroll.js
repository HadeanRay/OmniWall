/**
 * 无限滚动处理模块
 */

class InfiniteScroll {
    constructor(posterGrid) {
        this.posterGrid = posterGrid;
    }

    /**
     * 设置无限滚动事件监听器
     * 包括鼠标滚轮和触摸事件支持
     */
    setupInfiniteScrollListeners() {
        const posterGrid = this.posterGrid;
        
        if (!posterGrid.gsap) {
            console.warn('GSAP未加载，使用默认滚轮事件');
            this.setupWheelListener();
            return;
        }
        
        console.log('设置无限滑动事件监听器（鼠标滚轮模式）');
        
        // 鼠标滚轮事件 - 无限横向滚动
        posterGrid.container.addEventListener('wheel', (event) => {
            event.preventDefault(); // 阻止默认滚动行为
            
            // 将滚轮的deltaY转换为横向移动距离 - 降低灵敏度
            const scrollDistance = event.deltaY * 0.8; // 降低滚动灵敏度，使滚动更慢
            
            // 处理无限横向滚动
            this.handleInfiniteWheelScroll(scrollDistance);
        }, { passive: false });
        
        // 触摸设备支持（保持拖拽模式，因为触摸更适合拖拽）
        posterGrid.container.addEventListener('touchstart', (event) => {
            posterGrid.if_movable = true;
            posterGrid.mouse_x = event.touches[0].clientX;
            posterGrid.mouse_y = event.touches[0].clientY;
            event.preventDefault();
        });
        
        posterGrid.container.addEventListener('touchend', () => {
            posterGrid.if_movable = false;
        });
        
        posterGrid.container.addEventListener('touchmove', (event) => {
            if (posterGrid.if_movable) {
                this.handleInfiniteScroll(event.touches[0].clientX, event.touches[0].clientY);
                event.preventDefault();
            }
        });
    }

    /**
     * 处理触摸拖拽的无限滚动
     * @param {number} clientX - 触摸点X坐标
     * @param {number} clientY - 触摸点Y坐标
     */
    handleInfiniteScroll(clientX, clientY) {
        const posterGrid = this.posterGrid;
        
        // 检查是否可以移动以及GSAP是否已加载
        if (!posterGrid.if_movable || !posterGrid.gsap) return;
        
        // 计算横向移动距离
        const distance_x = (clientX - posterGrid.mouse_x) / posterGrid.scale_nums;
        // 只处理横向移动，忽略纵向移动
        const distance_y = 0;
        
        // 计算循环距离参数
        const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--poster-gap')) || 12;
        
        // 重新计算循环距离，按照initImagePositions中的列布局逻辑准确计算
        // 分析img_data以确定实际列布局
        let groupTitleCount = 0;
        let tvShowCount = 0;
        
        // 遍历img_data统计各类型元素数量
        for (let i = 0; i < posterGrid.img_data.length; i++) {
            const img = posterGrid.img_data[i];
            if (img.type === 'group-title') {
                groupTitleCount++;
            } else if (img.type === 'tv-show') {
                tvShowCount++;
            }
        }
        
        // 按照initImagePositions中的算法计算实际列数
        // 首先构建列布局结构
        const columnLayout = [];
        let currentColumn = { type: null, count: 0, items: [] };
        
        for (let i = 0; i < posterGrid.img_data.length; i++) {
            const img = posterGrid.img_data[i];
            
            if (currentColumn.type === null) {
                currentColumn.type = img.type;
                currentColumn.count = 1;
                currentColumn.items = [img];
            } else if (currentColumn.type === img.type) {
                currentColumn.count++;
                currentColumn.items.push(img);
            } else {
                columnLayout.push({ ...currentColumn });
                currentColumn = {
                    type: img.type,
                    count: 1,
                    items: [img]
                };
            }
        }
        
        if (currentColumn.type !== null) {
            columnLayout.push({ ...currentColumn });
        }
        
        // 计算实际列数（按照initImagePositions中的逻辑）
        const maxRows = posterGrid.optimalRows || 2;
        let actualCols = 0;
        
        for (const column of columnLayout) {
            if (column.type === 'group-title') {
                // 组标题列：每个组标题占一列（现在宽度为原来的一半）
                actualCols += column.items.length;
            } else {
                // 海报卡片列：按行数排列
                let rows = 0;
                for (let i = 0; i < column.items.length; i++) {
                    rows++;
                    if (rows >= maxRows) {
                        rows = 0;
                        actualCols++;
                    }
                }
                // 如果这列没有填满，也需要计算为一列
                if (rows > 0) {
                    actualCols++;
                }
            }
        }

        // 总列数 = 实际列数
        const totalCols = actualCols;
        
        // 循环距离 = 组标题数量 * (海报宽度/2 + 间隙) + 海报列数量 * (海报宽度 + 间隙) - 最后一个间隙
        // 需要分别计算组标题列和海报列的宽度贡献
        let groupTitleCols = 0;
        let posterCols = 0;
        
        // 重新计算各类型列的数量
        for (const column of columnLayout) {
            if (column.type === 'group-title') {
                // 每个组标题占据海报宽度一半的空间
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
        
        // 计算循环距离：组标题按半宽计算，海报按全宽计算
        const cycleDistance = groupTitleCols * (posterGrid.poster_width / 2 + gap) + 
                            posterCols * (posterGrid.poster_width + gap) - gap;
        
        // 更新所有海报和组标题的位置
        posterGrid.img_data.forEach((img) => {
            let duration = 0.8; // 默认动画时长
            img.mov_x += distance_x;
            // 纵向位置保持不变
            // img.mov_y += distance_y; // 禁用纵向移动
            
            // 获取当前总位置
            const total_x = img.x + img.mov_x;
            const total_y = img.y + img.mov_y;
            
            // 水平边界循环检测 - 基于实际的列宽总距离
            if (total_x > cycleDistance + posterGrid.poster_width) {
                img.mov_x -= (cycleDistance);
                duration = 0; // 瞬间移动
            }
            if (total_x < -posterGrid.poster_width * 2) {
                img.mov_x += (cycleDistance );
                duration = 0;
            }
            
            // 禁用垂直边界循环检测
            // 保持纵向位置固定，不允许循环
            
            // 停止之前的动画
            if (img.ani) img.ani.kill();
            
            // 计算新的目标位置 - 只横向移动
            const target_x = img.x + img.mov_x;
            const target_y = img.y; // 保持原始纵向位置
            
            // 应用新动画 - 只横向移动
            img.ani = posterGrid.gsap.to(img.node, {
                x: target_x,
                y: target_y, // 保持纵向位置不变
                duration: duration,
                ease: 'power4.out'
            });
        });
        
        // 更新鼠标位置
        posterGrid.mouse_x = clientX;
        posterGrid.mouse_y = clientY;
    }

    /**
     * 处理鼠标滚轮的无限滚动
     * @param {number} scrollDistance - 滚动距离
     */
    handleInfiniteWheelScroll(scrollDistance) {
        const posterGrid = this.posterGrid;
        
        // 检查GSAP是否已加载
        if (!posterGrid.gsap) return;
        
        // 使用滚轮距离作为横向移动距离 - 进一步降低移动距离
        const distance_x = scrollDistance * 0.6 / posterGrid.scale_nums; // 降低移动距离，使滚动更慢更平滑
        
        // 使用body窗口的实时宽度作为循环距离
        const bodyWidth = document.body.clientWidth;
        // 计算循环距离参数
        const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--poster-gap')) || 12;
        
        // 重新计算循环距离，按照initImagePositions中的列布局逻辑准确计算
        // 分析img_data以确定实际列布局
        let groupTitleCount = 0;
        let tvShowCount = 0;
        
        // 遍历img_data统计各类型元素数量
        for (let i = 0; i < posterGrid.img_data.length; i++) {
            const img = posterGrid.img_data[i];
            if (img.type === 'group-title') {
                groupTitleCount++;
            } else if (img.type === 'tv-show') {
                tvShowCount++;
            }
        }
        
        // 按照initImagePositions中的算法计算实际列数
        // 首先构建列布局结构
        const columnLayout = [];
        let currentColumn = { type: null, count: 0, items: [] };
        
        for (let i = 0; i < posterGrid.img_data.length; i++) {
            const img = posterGrid.img_data[i];
            
            if (currentColumn.type === null) {
                currentColumn.type = img.type;
                currentColumn.count = 1;
                currentColumn.items = [img];
            } else if (currentColumn.type === img.type) {
                currentColumn.count++;
                currentColumn.items.push(img);
            } else {
                columnLayout.push({ ...currentColumn });
                currentColumn = {
                    type: img.type,
                    count: 1,
                    items: [img]
                };
            }
        }
        
        if (currentColumn.type !== null) {
            columnLayout.push({ ...currentColumn });
        }
        
        // 计算实际列数（按照initImagePositions中的逻辑）
        const maxRows = posterGrid.optimalRows || 2;
        let actualCols = 0;
        
        for (const column of columnLayout) {
            if (column.type === 'group-title') {
                // 组标题列：每个组标题占一列（现在宽度为原来的一半）
                actualCols += column.items.length;
            } else {
                // 海报卡片列：按行数排列
                let rows = 0;
                for (let i = 0; i < column.items.length; i++) {
                    rows++;
                    if (rows >= maxRows) {
                        rows = 0;
                        actualCols++;
                    }
                }
                // 如果这列没有填满，也需要计算为一列
                if (rows > 0) {
                    actualCols++;
                }
            }
        }

        // 总列数 = 实际列数
        const totalCols = actualCols;
        
        // 循环距离 = 组标题数量 * (海报宽度/2 + 间隙) + 海报列数量 * (海报宽度 + 间隙) - 最后一个间隙
        // 需要分别计算组标题列和海报列的宽度贡献
        let groupTitleCols = 0;
        let posterCols = 0;
        
        // 重新计算各类型列的数量
        for (const column of columnLayout) {
            if (column.type === 'group-title') {
                // 每个组标题占据海报宽度一半的空间
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
        
        // 计算循环距离：组标题按半宽计算，海报按全宽计算
        const cycleDistance = groupTitleCols * (posterGrid.poster_width / 2 + gap) + 
                            posterCols * (posterGrid.poster_width + gap) - gap;
        
        // 调试信息

        console.log(`无限滑动调试: 组标题数=${groupTitleCount}, 海报数=${tvShowCount}, 总列数=${totalCols}, 循环距离=${cycleDistance}px, 卡片宽度=${posterGrid.poster_width}px, body宽度=${bodyWidth}px`);
        
        // 更新所有海报和组标题的位置
        posterGrid.img_data.forEach((img) => {
            let duration = 0.8; // 增加动画时长，让滚动更平滑
            img.mov_x += distance_x;
            
            // 获取当前总位置
            const total_x = img.x + img.mov_x;
            
            // 水平边界循环检测 - 修复循环逻辑，确保两个区域无缝连接
            // 右侧边界：当卡片移动到bodyWidth + 海报宽度*2时，向左移动cycleDistance距离
            if (total_x > bodyWidth + posterGrid.poster_width * 2) {
                img.mov_x -= cycleDistance;
                duration = 0; // 瞬间移动
                console.log(`右侧循环: 卡片位置=${total_x}, 循环到=${img.x + img.mov_x}`);
            }
            // 左侧边界：当卡片移动到-poster_width时，向右移动cycleDistance距离
            if (total_x < -posterGrid.poster_width - posterGrid.poster_width) {
                img.mov_x += cycleDistance;
                duration = 0;
                console.log(`左侧循环: 卡片位置=${total_x}, 循环到=${img.x + img.mov_x}`);
            }
            
            // 停止之前的动画
            if (img.ani) img.ani.kill();
            
            // 计算新的目标位置 - 只横向移动
            const target_x = img.x + img.mov_x;
            const target_y = img.y; // 保持原始纵向位置
            
            // 应用新动画 - 使用更平滑的缓动函数
            img.ani = posterGrid.gsap.to(img.node, {
                x: target_x,
                y: target_y, // 保持纵向位置不变
                duration: duration,
                ease: 'power3.out' // 使用更平滑的缓动函数
            });
        });
    }

    /**
     * 设置默认滚轮事件监听器
     */
    setupWheelListener() {
        const posterGrid = this.posterGrid;
        
        // 监听鼠标滚轮事件，实现平滑横向滚动
        posterGrid.container.addEventListener('wheel', (event) => {
            // 防止默认的垂直滚动行为
            event.preventDefault();
            
            // 获取滚动容器
            const scrollContainer = posterGrid.container.parentElement;
            if (!scrollContainer) return;
            
            // 简化滚动逻辑，直接使用deltaY值进行滚动
            const scrollAmount = event.deltaY * 1.5; // 稍微增加滚动灵敏度
            
            // 平滑滚动实现
            this.smoothScroll(scrollContainer, scrollAmount);
            
        }, { passive: false }); // 必须设置为非被动事件，才能调用 preventDefault()
    }

    /**
     * 平滑滚动实现
     * @param {HTMLElement} scrollContainer - 滚动容器
     * @param {number} deltaX - 滚动距离
     */
    smoothScroll(scrollContainer, deltaX) {
        const posterGrid = this.posterGrid;
        
        // 验证参数
        if (!scrollContainer || typeof deltaX !== 'number') {
            console.warn('无效的滚动参数', { scrollContainer, deltaX });
            return;
        }

        // 如果已经有滚动动画在进行，先停止它
        if (posterGrid.scrollAnimationId) {
            cancelAnimationFrame(posterGrid.scrollAnimationId);
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
            posterGrid.scrollAnimationId = null;
            return;
        }
        
        // 缓动函数：easeOutCubic
        const easeOutCubic = (t) => {
            if (t < 0 || t > 1) return Math.min(Math.max(t, 0), 1); // 确保t在[0,1]范围内
            return 1 - Math.pow(1 - t, 3);
        };
        
        // 动画时长（毫秒）- 根据滚动距离调整
        const baseDuration = 200;
        const scrollDistance = Math.abs(deltaX);
        const duration = Math.min(baseDuration + scrollDistance * 0.05, 500); // 减少最大时长
        
        const animateScroll = (currentTime) => {
            try {
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
                    posterGrid.scrollAnimationId = requestAnimationFrame(animateScroll);
                } else {
                    posterGrid.scrollAnimationId = null;
                }
            } catch (error) {
                console.error('滚动动画执行出错:', error);
                posterGrid.scrollAnimationId = null;
            }
        };
        
        // 启动动画
        posterGrid.scrollAnimationId = requestAnimationFrame(animateScroll);
    }
}

module.exports = InfiniteScroll;