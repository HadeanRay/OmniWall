// 测试修复后的nfo文件解析逻辑
const fs = require('fs');
const path = require('path');

// 模拟main.js中的scanEpisodes函数（修复后的版本）
function testScanEpisodes() {
    const tvShowPath = 'E:/Sync/smb/TV/mono女孩 (2025)';
    const season = 1;
    const episodes = [];
    const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'];
    
    try {
        // 获取季文件夹路径（修复后的逻辑）
        let seasonPath = tvShowPath;
        // 对于第1季，也需要查找Season 1文件夹
        if (season === 1) {
            const season1Path = path.join(tvShowPath, 'Season 1');
            if (fs.existsSync(season1Path)) {
                seasonPath = season1Path;
            }
        }
        
        console.log('扫描路径:', seasonPath);
        const items = fs.readdirSync(seasonPath, { withFileTypes: true });
        
        // 首先处理 .nfo 文件
        const processedEpisodes = new Map();
        const nfoFiles = items.filter(item => item.isFile() && item.name.toLowerCase().endsWith('.nfo'));
        
        console.log(`找到 ${nfoFiles.length} 个 nfo 文件`);
        
        // 处理所有nfo文件
        nfoFiles.forEach(nfoItem => {
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
                    break;
                }
            }
            
            if (episodeNumber !== null) {
                // 查找对应的视频文件
                const baseName = nfoItem.name.replace('.nfo', '');
                const videoFile = items.find(item => 
                    item.isFile() && 
                    item.name.startsWith(baseName) &&
                    videoExtensions.some(ext => item.name.toLowerCase().endsWith(ext))
                );
                
                if (videoFile) {
                    processedEpisodes.set(episodeNumber, {
                        number: episodeNumber,
                        name: baseName,
                        path: path.join(seasonPath, videoFile.name),
                        nfoPath: path.join(seasonPath, nfoItem.name)
                    });
                }
            }
        });
        
        // 按集号排序并构建最终剧集列表
        const sortedEpisodes = Array.from(processedEpisodes.values()).sort((a, b) => a.number - b.number);
        
        console.log('\n=== 最终剧集列表 ===');
        console.log('剧集数量:', sortedEpisodes.length);
        sortedEpisodes.forEach(ep => {
            console.log(`集 ${ep.number}: ${ep.name}`);
        });
        
        episodes.push(...sortedEpisodes);
        
    } catch (error) {
        console.error(`扫描集数出错:`, error);
    }
    
    return episodes;
}

// 运行测试
const episodes = testScanEpisodes();
console.log('\n=== 测试完成 ===');
console.log('总共找到剧集:', episodes.length);