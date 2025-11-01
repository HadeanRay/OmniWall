/**
 * GSAP加载模块
 */

class GsapLoader {
    constructor(posterGrid) {
        this.posterGrid = posterGrid;
    }

    /**
     * 加载GSAP库
     */
    async loadGSAP() {
        const posterGrid = this.posterGrid;
        return new Promise((resolve, reject) => {
            if (window.gsap) {
                posterGrid.gsap = window.gsap;
                resolve();
                return;
            }
            
            // 动态加载GSAP
            const script = document.createElement('script');
            script.src = '../../../node_modules/gsap/dist/gsap.min.js';
            script.onload = () => {
                posterGrid.gsap = window.gsap;
                resolve();
            };
            script.onerror = () => reject(new Error('GSAP加载失败'));
            document.head.appendChild(script);
        });
    }
}

module.exports = GsapLoader;