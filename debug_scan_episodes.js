const fs = require('fs');
const path = require('path');

// 模拟scanEpisodes函数
function debugScanEpisodes(tvShowPath, season) {
    const episodes = [];
    const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'];
    
    console.log('=== 开始扫描季集数据 ===');
    console.log('电视剧路径:', tvShowPath);
    console.log('季:', season);
    
    try {
        // 获取季文件夹路径
        let seasonPath = tvShowPath;
        // 对于第1季，也需要查找Season 1文件夹
        if (season === 1) {
            const season1Path = path.join(tvShowPath, 'Season 1');
            if (fs.existsSync(season1Path)) {
                seasonPath = season1Path;
            }
        } else if (season > 1) {
            // 简化处理，假设只有第一季
            seasonPath = path.join(tvShowPath, 'Season 1');
        }
        
        console.log('季文件夹路径:', seasonPath);
        
        // 检查路径是否存在
        if (!fs.existsSync(seasonPath)) {
            console.log('季文件夹不存在');
            return episodes;
        }
        
        const items = fs.readdirSync(seasonPath, { withFileTypes: true });
        console.log('文件夹中的项目数量:', items.length);
        
        // 首先处理 .nfo 文件
        const processedEpisodes = new Map();
        const nfoFiles = items.filter(item => item.isFile() && item.name.toLowerCase().endsWith('.nfo'));
        
        console.log(`找到 ${nfoFiles.length} 个 nfo 文件`);
        
        // 处理所有nfo文件
        nfoFiles.forEach((nfoItem, index) => {
            console.log(`\n--- 处理nfo文件 ${index + 1}: ${nfoItem.name} ---`);
            const nfoPath = path.join(seasonPath, nfoItem.name);
            
            try {
                // 从nfo文件名中提取集号
                let episodeNumber = null;
                const name = nfoItem.name.toLowerCase();
                
                const patterns = [
                    /s\d{1,2}e(\d{1,3})/i,      // S01E01
                    /\[(\d{1,3})\]/,            // [01] 或 [1]
                    /第(\d{1,3})[集话]/,        // 第01集、第01话
                    /-(\d{1,3})v\d/,            // -01v1 格式
                    /-\s*(\d{1,3})v\d/,         // - 01v1 格式（带空格）
                    /-\s*(\d{1,3})\s*\[\-/,  // - 01 [ 或 - 01 -
                    /(\d{1,3})\s*-\s*/,         // 01 -
                    /-\s*(\d{1,3})\s*\./,      // - 01 .
                    /\s(\d{1,3})\s*\[\-/,     // 空格 01 空格 [
                    /(\d{1,3})\s*-\s*/,         // 01 - 空格
                    /-(\d{1,3})\s*\[\-/,       // -01 [ 或 -01-
                    /\[(\d{1,3})\][^\]]*$/,     // [01] 在末尾
                    /^.*\[(\d{1,3})\]/,         // [01] 在任意位置
                    /\b(\d{1,3})\b/,            // 直接的数字（最后尝试）
                ];
                
                for (const pattern of patterns) {
                    const match = name.match(pattern);
                    if (match && match[1]) {
                        episodeNumber = parseInt(match[1]);
                        console.log(`匹配模式 ${pattern}，提取集号: ${episodeNumber}`);
                        break;
                    }
                }
                
                if (episodeNumber === null) {
                    const numberMatch = name.match(/(\d{1,3})/);
                    if (numberMatch) {
                        episodeNumber = parseInt(numberMatch[1]);
                        console.log(`使用宽松匹配，提取集号: ${episodeNumber}`);
                    }
                }
                
                if (episodeNumber !== null) {
                    // 查找对应的视频文件
                    const baseName = nfoItem.name.replace('.nfo', '');
                    console.log(`查找对应的视频文件，基础名: ${baseName}`);
                    
                    const videoFile = items.find(item => 
                        item.isFile() && 
                        item.name.startsWith(baseName) &&
                        videoExtensions.some(ext => item.name.toLowerCase().endsWith(ext))
                    );
                    
                    if (videoFile) {
                        console.log(`找到对应的视频文件: ${videoFile.name}`);
                        processedEpisodes.set(episodeNumber, {
                            number: episodeNumber,
                            name: baseName,
                            path: path.join(seasonPath, videoFile.name),
                            nfoPath: nfoPath
                        });
                    } else {
                        console.log(`未找到对应的视频文件`);
                    }
                } else {
                    console.log('无法提取集号');
                }
            } catch (error) {
                console.log(`处理nfo文件失败: ${error.message}`);
            }
        });
        
        console.log('\n=== nfo文件处理结果 ===');
        console.log('已处理剧集数量:', processedEpisodes.size);
        
        // 按集号排序并构建最终剧集列表
        const sortedEpisodes = Array.from(processedEpisodes.values()).sort((a, b) => a.number - b.number);
        
        console.log('\n=== 最终剧集列表 ===');
        sortedEpisodes.forEach(ep => {
            console.log(`集 ${ep.number}: ${ep.name}`);
        });
        
        episodes.push(...sortedEpisodes);
        
    } catch (error) {
        console.error(`扫描集数出错:`, error);
    }
    
    return episodes;
}

// 测试
const testPath = 'E:/Sync/smb/TV/mono女孩 (2025)';
const episodes = debugScanEpisodes(testPath, 1);
console.log('\n=== 函数返回结果 ===');
console.log('剧集数量:', episodes.length);