const fs = require('fs');
const path = require('path');

// 测试路径
const testPath = 'E:/Sync/smb/TV/mono女孩 (2025)/Season 1';

console.log('检查路径:', testPath);
try {
    if (fs.existsSync(testPath)) {
        console.log('路径存在');
        const files = fs.readdirSync(testPath);
        console.log('文件数量:', files.length);
        console.log('文件列表:');
        files.forEach((file, index) => {
            const fullPath = path.join(testPath, file);
            const isDir = fs.statSync(fullPath).isDirectory();
            console.log(`  ${index + 1}. ${file} ${isDir ? '(文件夹)' : ''}`);
        });
        
        // 检查nfo文件
        const nfoFiles = files.filter(f => f.toLowerCase().endsWith('.nfo'));
        console.log('\nnfo文件数量:', nfoFiles.length);
        console.log('nfo文件列表:');
        nfoFiles.forEach((file, index) => {
            console.log(`  ${index + 1}. ${file}`);
        });
        
        // 检查视频文件
        const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'];
        const videoFiles = files.filter(f => {
            const fullPath = path.join(testPath, f);
            return fs.statSync(fullPath).isFile() && 
                   videoExtensions.some(ext => f.toLowerCase().endsWith(ext));
        });
        console.log('\n视频文件数量:', videoFiles.length);
        console.log('视频文件列表:');
        videoFiles.forEach((file, index) => {
            console.log(`  ${index + 1}. ${file}`);
        });
    } else {
        console.log('路径不存在');
    }
} catch (error) {
    console.log('错误:', error.message);
}