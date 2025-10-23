const fs = require('fs');
const path = require('path');

// 模拟的文件名列表（基于观察到的实际文件名格式）
const testFiles = [
    'mono女孩 - S01E01 - mono之旅.mp4',
    'mono女孩 - S01E01 - mono之旅.nfo',
    '噗妮露是可爱史莱姆 - S01E01 - 我恨你，但也爱你.mp4',
    '噗妮露是可爱史莱姆 - S01E01 - 我恨你，但也爱你.nfo'
];

console.log('=== 测试nfo文件解析逻辑 ===');

testFiles.forEach(fileName => {
    console.log('\n测试文件名:', fileName);
    
    // 检查是否是nfo文件
    if (fileName.toLowerCase().endsWith('.nfo')) {
        console.log('这是一个nfo文件');
        const name = fileName.toLowerCase();
        
        // 尝试各种匹配模式
        const patterns = [
            { name: 'S01E01格式', pattern: /s\d{1,2}e(\d{1,3})/i },
            { name: '[数字]格式', pattern: /\[(\d{1,3})\]/ },
            { name: '第数字集格式', pattern: /第(\d{1,3})[集话]/ },
            { name: '-数字v数字格式', pattern: /-(\d{1,3})v\d/ },
            { name: '- 数字v数字格式', pattern: /-\s*(\d{1,3})v\d/ },
            { name: '- 数字 [格式', pattern: /-\s*(\d{1,3})\s*\[/ },
            { name: '数字 - 格式', pattern: /(\d{1,3})\s*-\s*/ },
            { name: '- 数字 .格式', pattern: /-\s*(\d{1,3})\s*\./ },
            { name: '空格 数字 空格 [格式', pattern: /\s(\d{1,3})\s*\[\-/ },
            { name: '数字 - 空格格式', pattern: /(\d{1,3})\s*-\s*/ },
            { name: '-数字 [格式', pattern: /-(\d{1,3})\s*\[\-/ },
            { name: '[数字]在末尾格式', pattern: /\[(\d{1,3})\]/ },
            { name: '直接数字匹配', pattern: /\b(\d{1,3})\b/ }
        ];
        
        let episodeNumber = null;
        for (const {name: patternName, pattern} of patterns) {
            const match = name.match(pattern);
            if (match && match[1]) {
                episodeNumber = parseInt(match[1]);
                console.log(`✓ 匹配模式: ${patternName}, 提取集号: ${episodeNumber}`);
                break;
            }
        }
        
        if (episodeNumber === null) {
            console.log('✗ 所有模式匹配失败');
        }
    }
});

console.log('\n=== 测试完成 ===');