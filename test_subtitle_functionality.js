// 字幕功能测试脚本
const fs = require('fs');
const path = require('path');

// 测试字幕文件扫描功能
function testSubtitleScan() {
    console.log('=== 测试字幕文件扫描功能 ===');
    
    // 模拟视频文件路径
    const testVideoPath = 'E:\\Sync\\smb\\TV\\怪人的沙拉碗 (2024)\\Season 1\\怪人的沙拉碗 - S01E01 - 麒麟降临（来自异世界）.mkv';
    console.log('测试视频路径:', testVideoPath);
    
    // 检查路径是否存在
    if (fs.existsSync(testVideoPath)) {
        console.log('✅ 视频文件存在');
        
        // 检查目录是否存在
        const dirPath = path.dirname(testVideoPath);
        if (fs.existsSync(dirPath)) {
            console.log('✅ 目录存在:', dirPath);
            
            // 列出目录中的文件
            const files = fs.readdirSync(dirPath);
            console.log('目录中的文件:', files);
            
            // 查找字幕文件
            const subtitleFiles = files.filter(file => {
                const ext = path.extname(file).toLowerCase();
                return ['.srt', '.vtt', '.ass', '.ssa', '.sub'].includes(ext);
            });
            
            console.log('找到的字幕文件:', subtitleFiles);
            
        } else {
            console.log('❌ 目录不存在');
        }
    } else {
        console.log('❌ 视频文件不存在');
    }
    
    console.log('');
}

// 测试路径解码功能
function testPathDecoding() {
    console.log('=== 测试路径解码功能 ===');
    
    const encodedPath = '/E:/Sync/smb/TV/%E6%80%AA%E4%BA%BA%E7%9A%84%E6%B2%99%E6%8B%89%E7%A2%97%20(2024)/Season%201/%E6%80%AA%E4%BA%BA%E7%9A%84%E6%B2%99%E6%8B%89%E7%A2%97%20-%20S01E01%20-%20%E9%BA%92%E9%BA%9F%E9%99%8D%E4%B8%B4%EF%BC%88%E6%9D%A5%E8%87%AA%E5%BC%82%E4%B8%96%E7%95%8C%EF%BC%89.mkv';
    console.log('编码路径:', encodedPath);
    
    let decodedPath = encodedPath.replace('file://', '');
    decodedPath = decodeURIComponent(decodedPath);
    console.log('解码后:', decodedPath);
    
    // 修复路径问题
    if (decodedPath.startsWith('X:\\')) {
        decodedPath = decodedPath.substring(2);
    }
    console.log('修复后:', decodedPath);
    
    console.log('');
}

// 运行测试
testPathDecoding();
testSubtitleScan();

console.log('测试完成！');