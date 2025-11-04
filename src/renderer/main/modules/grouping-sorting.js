/**
 * 分组和排序模块
 */

class GroupingSorting {
    constructor(posterGrid) {
        this.posterGrid = posterGrid;
    }

    /**

     * 排序电视剧列表

     * @param {Array} tvShows - 电视剧列表

     * @returns {Array} 排序后的电视剧列表

     */

    sortTvShows(tvShows) {

        const posterGrid = this.posterGrid;

        if (!tvShows || tvShows.length === 0) return tvShows;



        try {

            const sortedShows = [...tvShows]; // 创建副本避免修改原数组



            let result;

            switch (posterGrid.currentSortType) {

                case 'name-asc':

                    result = sortedShows.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

                    break;

                

                case 'name-desc':

                    result = sortedShows.sort((a, b) => b.name.localeCompare(a.name, 'zh-CN'));

                    break;

                

                case 'date-asc':

                    // 按首播时间升序 (旧→新)

                    result = sortedShows.sort((a, b) => {

                        const timeA = this.getTvShowPremieredTime(a);

                        const timeB = this.getTvShowPremieredTime(b);

                        return timeA - timeB;

                    });

                    break;

                

                case 'date-desc':

                    // 按首播时间降序 (新→旧)

                    result = sortedShows.sort((a, b) => {

                        const timeA = this.getTvShowPremieredTime(a);

                        const timeB = this.getTvShowPremieredTime(b);

                        return timeB - timeA;

                    });

                    break;

                

                default:

                    result = sortedShows;

            }

            

            return result;

        } catch (error) {

            console.error('排序电视剧列表时出错:', error);

            return tvShows; // 返回原始列表

        }

    }

    /**
     * 获取电视剧的修改时间
     * @param {Object} tvShow - 电视剧对象
     * @returns {number} 修改时间的时间戳
     */
    getTvShowModifyTime(tvShow) {
        if (!tvShow || !tvShow.firstEpisode || !tvShow.firstEpisode.modifiedTime) {
            return 0;
        }
        try {
            return new Date(tvShow.firstEpisode.modifiedTime).getTime();
        } catch (error) {
            console.error('获取电视剧修改时间时出错:', error);
            return 0;
        }
    }

    /**
     * 获取电视剧的首播时间
     * @param {Object} tvShow - 电视剧对象
     * @returns {number} 首播时间的时间戳
     */
    getTvShowPremieredTime(tvShow) {
        if (!tvShow) {
            return 0;
        }
        
        if (tvShow.premiered) {
            // 本地电视剧数据使用premiered字段
            try {
                const premieredDate = new Date(tvShow.premiered);
                if (isNaN(premieredDate.getTime())) {
                    return 0;
                }
                // 设置为该月的第一天
                premieredDate.setDate(1);
                return premieredDate.getTime();
            } catch (error) {
                console.error('获取电视剧首播时间时出错:', error);
                return 0;
            }
        }
        return 0;
    }

    /**
     * 获取电视剧的季数
     * @param {Object} tvShow - 电视剧对象
     * @returns {number} 季数
     */
    getTvShowSeasonsCount(tvShow) {
        if (!tvShow || !tvShow.seasons || !Array.isArray(tvShow.seasons)) {
            return 0;
        }
        return tvShow.seasons.length;
    }

    /**
     * 根据排序类型获取分组键
     * @param {Object} tvShow - 电视剧对象
     * @returns {string} 分组键
     */
    getGroupKey(tvShow) {
        const posterGrid = this.posterGrid;
        
        switch (posterGrid.currentSortType) {
            case 'name-asc':
            case 'name-desc':
                // 按首字母分组（包括拼音首字母）
                return posterGrid.utils.getPinyinFirstLetter(tvShow.name);
            
            case 'date-asc':
            case 'date-desc':
                // 按季度分组
                const premieredTime = this.getTvShowPremieredTime(tvShow);
                if (premieredTime > 0) {
                    const date = new Date(premieredTime);
                    const year = date.getFullYear();
                    const month = date.getMonth() + 1; // 月份从0开始，需要加1
                    const quarter = Math.ceil(month / 3); // 计算季度
                    return `${year}年Q${quarter}`;
                }
                return '未知';
                
            default:
                return '默认';
        }
    }

    /**
     * 根据排序类型对分组键进行排序
     * @param {Array} groupKeys - 分组键数组
     * @returns {Array} 排序后的分组键数组
     */
    sortGroupKeys(groupKeys) {
        const posterGrid = this.posterGrid;
        
        switch (posterGrid.currentSortType) {
            case 'name-asc':
                // 按字母顺序排序组（包括拼音首字母）
                return groupKeys.sort((a, b) => {
                    // #组排在最后
                    if (a === '#' && b !== '#') return 1;
                    if (a !== '#' && b === '#') return -1;
                    // 其他按字母顺序排序
                    return a.localeCompare(b, 'zh-CN');
                });
                
            case 'name-desc':
                // 按字母倒序排序组（包括拼音首字母）
                return groupKeys.sort((a, b) => {
                    // #组排在最后
                    if (a === '#' && b !== '#') return 1;
                    if (a !== '#' && b === '#') return -1;
                    // 其他按字母倒序排序
                    return b.localeCompare(a, 'zh-CN');
                });
                
            case 'date-asc':
                // 按季度升序排序组
                return groupKeys.sort((a, b) => {
                    if (a === '未知') return 1;
                    if (b === '未知') return -1;
                    // 解析 "YYYY年QX" 格式
                    const [, yearA, quarterA] = a.match(/(\d+)年Q(\d)/) || [];
                    const [, yearB, quarterB] = b.match(/(\d+)年Q(\d)/) || [];
                    if (!yearA || !yearB) return a.localeCompare(b);
                    const yearDiff = parseInt(yearA) - parseInt(yearB);
                    if (yearDiff !== 0) return yearDiff;
                    return parseInt(quarterA) - parseInt(quarterB);
                });
                
            case 'date-desc':
                // 按季度降序排序组
                return groupKeys.sort((a, b) => {
                    if (a === '未知') return 1;
                    if (b === '未知') return -1;
                    // 解析 "YYYY年QX" 格式
                    const [, yearA, quarterA] = a.match(/(\d+)年Q(\d)/) || [];
                    const [, yearB, quarterB] = b.match(/(\d+)年Q(\d)/) || [];
                    if (!yearA || !yearB) return a.localeCompare(b);
                    const yearDiff = parseInt(yearB) - parseInt(yearA);
                    if (yearDiff !== 0) return yearDiff;
                    return parseInt(quarterB) - parseInt(quarterA);
                });
                
            default:
                return groupKeys;
        }
    }

    /**

     * 根据当前排序类型对电视剧进行分组

     * @param {Array} tvShows - 电视剧列表

     * @returns {Array} 分组后的电视剧数据

     */

    groupTvShows(tvShows) {

        const posterGrid = this.posterGrid;

        if (!tvShows || tvShows.length === 0) return [];



        // 检查缓存

        const cacheKey = `group_${posterGrid.currentSortType}_${tvShows.length}`;

        if (this.groupCache && this.groupCache[cacheKey]) {

            // 验证缓存有效性

            const cachedData = this.groupCache[cacheKey];

            if (cachedData.timestamp && (Date.now() - cachedData.timestamp < 5000)) { // 5秒缓存

                return cachedData.data;

            }

        }



        // 创建分组映射

        const groups = new Map();

        

        // 将电视剧分配到各组

        tvShows.forEach(tvShow => {

            const groupKey = this.getGroupKey(tvShow);

            if (!groups.has(groupKey)) {

                groups.set(groupKey, []);

            }

            groups.get(groupKey).push(tvShow);

        });

        

        // 转换为数组格式并排序

        const groupedArray = [];

        

        // 根据排序类型确定组的排序方式

        const sortedGroupKeys = this.sortGroupKeys(Array.from(groups.keys()));

        

        // 构建最终的分组数组

        sortedGroupKeys.forEach(key => {

            if (groups.has(key)) {

                groupedArray.push({

                    title: key,

                    items: groups.get(key)

                });

            }

        });

        

        return groupedArray;

    }
}

module.exports = GroupingSorting;