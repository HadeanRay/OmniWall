const fs = require('fs');
const path = require('path');

// 模拟的文件列表（基于观察到的实际文件名格式）
const mockFiles = [
    { name: 'mono女孩 - S01E01 - mono之旅.mp4', isFile: true },
    { name: 'mono女孩 - S01E01 - mono之旅.nfo', isFile: true },
    { name: '噗妮露是可爱史莱姆 - S01E01 - 我恨你，但也爱你.mp4', isFile: true },
    { name: '噗妮露是可爱史莱姆 - S01E01 - 我恨你，但也爱你.nfo', isFile: true }
];

console.log('=== 测试nfo文件与视频文件匹配逻辑 ===');

// 模拟scanEpisodes函数中的逻辑
const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'];
const processedEpisodes = new Map();

// 首先处理nfo文件
const nfoFiles = mockFiles.filter(item => 
    item.isFile && item.name.toLowerCase().endsWith('.nfo')
);

console.log(`找到 ${nfoFiles.length} 个 nfo 文件`);

nfoFiles.forEach(nfoItem => {
    console.log('\n处理nfo文件:', nfoItem.name);
    
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
            console.log(`提取集号: ${episodeNumber} (匹配模式: ${pattern})`);
            break;
        }
    }
    
    if (episodeNumber !== null) {
        // 查找对应的视频文件
        const baseName = nfoItem.name.replace('.nfo', '');
        console.log(`查找对应的视频文件，基础名: ${baseName}`);
        
        const videoFile = mockFiles.find(item => 
            item.isFile && 
            item.name.startsWith(baseName) &&
            videoExtensions.some(ext => item.name.toLowerCase().endsWith(ext))
        );
        
        if (videoFile) {
            console.log(`✓ 找到对应的视频文件: ${videoFile.name}`);
            processedEpisodes.set(episodeNumber, {
                number: episodeNumber,
                name: baseName,
                path: `mock://${videoFile.name}`,
                nfoPath: `mock://${nfoItem.name}`
            });
        } else {
            console.log(`✗ 未找到对应的视频文件`);
        }
    } else {
        console.log('✗ 无法提取集号');
    }
});

console.log('\n=== 最终处理的剧集 ===');
console.log('已处理剧集数量:', processedEpisodes.size);
processedEpisodes.forEach((episode, num) => {
    console.log(`集 ${num}: ${episode.name}`);
});

// 如果没有nfo文件，或者需要补充缺失的集数，扫描视频文件
if (processedEpisodes.size === 0) {
    console.log('未找到有效的nfo文件，扫描视频文件...');
    
    const videoFiles = mockFiles
        .filter(item => item.isFile && 
            videoExtensions.some(ext => item.name.toLowerCase().endsWith(ext)))
        .filter(item => {
            // 检查是否已经有对应的nfo文件处理过
            const baseName = item.name.replace(/\.[^.]+$/, ''); // 去除文件扩展名
            const existingEpisode = Array.from(processedEpisodes.values()).find(
                ep => ep.path === `mock://${item.name}`
            );
            return !existingEpisode;
        });
    
    console.log('扫描到的视频文件:', videoFiles.map(f => f.name));
}

console.log('\n=== 测试完成 ===');