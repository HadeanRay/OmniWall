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

            switch (posterGrid.currentSortType) {
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
     * 根据当前排序类型对电视剧进行分组
     * @param {Array} tvShows - 电视剧列表
     * @returns {Array} 分组后的电视剧数据
     */
    groupTvShows(tvShows) {
        const posterGrid = this.posterGrid;
        if (!tvShows || tvShows.length === 0) return [];

        // 创建分组映射
        const groups = new Map();
        
        // 根据排序类型确定分组键
        const getGroupKey = (tvShow) => {
            switch (posterGrid.currentSortType) {
                case 'name-asc':
                case 'name-desc':
                    // 按首字母分组（包括拼音首字母）
                    return posterGrid.getPinyinFirstLetter(tvShow.name);
                
                case 'date-asc':
                case 'date-desc':
                    // 按年份分组
                    const modifyTime = this.getTvShowModifyTime(tvShow);
                    if (modifyTime > 0) {
                        const year = new Date(modifyTime).getFullYear();
                        return year.toString();
                    }
                    return '未知';
                    
                case 'seasons-asc':
                case 'seasons-desc':
                    // 按季数分组
                    const seasonsCount = this.getTvShowSeasonsCount(tvShow);
                    if (seasonsCount === 0) return '无季数';
                    if (seasonsCount === 1) return '1季';
                    if (seasonsCount <= 5) return `${seasonsCount}季`;
                    return '5季以上';
                    
                default:
                    return '默认';
            }
        };
        
        // 将电视剧分配到各组
        tvShows.forEach(tvShow => {
            const groupKey = getGroupKey(tvShow);
            if (!groups.has(groupKey)) {
                groups.set(groupKey, []);
            }
            groups.get(groupKey).push(tvShow);
        });
        
        // 转换为数组格式并排序
        const groupedArray = [];
        
        // 根据排序类型确定组的排序方式
        let sortedGroupKeys = [];
        switch (posterGrid.currentSortType) {
            case 'name-asc':
                // 按字母顺序排序组（包括拼音首字母）
                sortedGroupKeys = Array.from(groups.keys()).sort((a, b) => {
                    // #组排在最后
                    if (a === '#' && b !== '#') return 1;
                    if (a !== '#' && b === '#') return -1;
                    // 其他按字母顺序排序
                    return a.localeCompare(b, 'zh-CN');
                });
                break;
            case 'name-desc':
                // 按字母倒序排序组（包括拼音首字母）
                sortedGroupKeys = Array.from(groups.keys()).sort((a, b) => {
                    // #组排在最后
                    if (a === '#' && b !== '#') return 1;
                    if (a !== '#' && b === '#') return -1;
                    // 其他按字母倒序排序
                    return b.localeCompare(a, 'zh-CN');
                });
                break;
            case 'date-asc':
                // 按年份升序排序组
                sortedGroupKeys = Array.from(groups.keys()).sort((a, b) => {
                    if (a === '未知') return 1;
                    if (b === '未知') return -1;
                    return parseInt(a) - parseInt(b);
                });
                break;
            case 'date-desc':
                // 按年份降序排序组
                sortedGroupKeys = Array.from(groups.keys()).sort((a, b) => {
                    if (a === '未知') return 1;
                    if (b === '未知') return -1;
                    return parseInt(b) - parseInt(a);
                });
                break;
            case 'seasons-asc':
                // 按季数升序排序组
                sortedGroupKeys = ['无季数', '1季', '2季', '3季', '4季', '5季', '5季以上'];
                break;
            case 'seasons-desc':
                // 按季数降序排序组
                sortedGroupKeys = ['5季以上', '5季', '4季', '3季', '2季', '1季', '无季数'];
                break;
            default:
                sortedGroupKeys = Array.from(groups.keys());
        }
        
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