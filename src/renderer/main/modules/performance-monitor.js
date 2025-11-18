/**
 * 性能监控模块
 */

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            frameCount: 0,
            lastTime: performance.now(),
            fps: 0,
            memoryUsage: {},
            scrollEvents: [],
            renderTimes: [],
            avgRenderTime: 0
        };
        this.fpsUpdateInterval = null;
        this.isMonitoring = false;
    }

    /**
     * 开始性能监控
     */
    startMonitoring() {
        if (this.isMonitoring) return;
        this.isMonitoring = true;
        this.updateFPS();
        console.log('性能监控已启动');
    }

    /**
     * 停止性能监控
     */
    stopMonitoring() {
        if (this.fpsUpdateInterval) {
            clearInterval(this.fpsUpdateInterval);
            this.fpsUpdateInterval = null;
        }
        this.isMonitoring = false;
        console.log('性能监控已停止');
    }

    /**
     * 更新FPS计算
     */
    updateFPS() {
        this.fpsUpdateInterval = setInterval(() => {
            const now = performance.now();
            const delta = now - this.metrics.lastTime;
            this.metrics.frameCount++;
            
            // 每秒更新一次FPS
            if (delta >= 1000) {
                this.metrics.fps = Math.round((this.metrics.frameCount * 1000) / delta);
                this.metrics.frameCount = 0;
                this.metrics.lastTime = now;
                
                // 输出性能指标
                this.logPerformanceMetrics();
            }
        }, 1000 / 60); // 每秒60次
    }

    /**
     * 记录渲染时间
     * @param {number} renderTime - 渲染耗时（毫秒）
     */
    recordRenderTime(renderTime) {
        this.metrics.renderTimes.push(renderTime);
        if (this.metrics.renderTimes.length > 100) {
            this.metrics.renderTimes.shift(); // 保持最多100个记录
        }
        // 计算平均渲染时间
        this.metrics.avgRenderTime = this.metrics.renderTimes.reduce((a, b) => a + b, 0) / this.metrics.renderTimes.length;
    }

    /**
     * 记录滚动事件
     * @param {number} scrollPosition - 滚动位置
     * @param {number} timestamp - 时间戳
     */
    recordScrollEvent(scrollPosition, timestamp) {
        this.metrics.scrollEvents.push({ scrollPosition, timestamp });
        if (this.metrics.scrollEvents.length > 100) {
            this.metrics.scrollEvents.shift(); // 保持最多100个记录
        }
    }

    /**
     * 获取内存使用情况
     * @returns {Object} 内存使用信息
     */
    getMemoryUsage() {
        if (performance.memory) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    }

    /**
     * 输出性能指标
     */
    logPerformanceMetrics() {
        const memoryUsage = this.getMemoryUsage();
        console.group('性能指标');
        console.log(`FPS: ${this.metrics.fps}`);
        console.log(`平均渲染时间: ${this.metrics.avgRenderTime.toFixed(2)}ms`);
        console.log(`可见元素数量: ${this.metrics.visibleElementsCount || 0}`);
        if (memoryUsage) {
            console.log(`内存使用: ${(memoryUsage.used / 1024 / 1024).toFixed(2)}MB / ${(memoryUsage.total / 1024 / 1024).toFixed(2)}MB`);
        }
        console.groupEnd();
    }

    /**
     * 性能分析报告
     * @returns {Object} 包含当前性能指标的对象
     */
    getPerformanceReport() {
        return {
            fps: this.metrics.fps,
            avgRenderTime: this.metrics.avgRenderTime,
            renderTimes: [...this.metrics.renderTimes],
            visibleElementsCount: this.metrics.visibleElementsCount || 0,
            memoryUsage: this.getMemoryUsage(),
            scrollEventCount: this.metrics.scrollEvents.length
        };
    }

    /**
     * 设置可见元素数量
     * @param {number} count - 可见元素数量
     */
    setVisibleElementsCount(count) {
        this.metrics.visibleElementsCount = count;
    }

    /**
     * 重置性能指标
     */
    resetMetrics() {
        this.metrics = {
            frameCount: 0,
            lastTime: performance.now(),
            fps: 0,
            memoryUsage: {},
            scrollEvents: [],
            renderTimes: [],
            avgRenderTime: 0
        };
    }
}

// 创建全局实例
const performanceMonitor = new PerformanceMonitor();

module.exports = { PerformanceMonitor, performanceMonitor };