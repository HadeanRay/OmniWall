const fs = require('fs');
const path = require('path');

// 测试季集扫描逻辑
function scanSeasons(tvShowPath) {
  const seasons = [];
  
  try {
    const items = fs.readdirSync(tvShowPath, { withFileTypes: true });
    
    const seasonFolders = items.filter(item => 
      item.isDirectory() && 
      (item.name.toLowerCase().includes('season') || 
       item.name.toLowerCase().includes('s') ||
       item.name.toLowerCase().includes('季') ||
       /^season\s*\d+/i.test(item.name) ||
       /^s\d+/i.test(item.name) ||
       /^第\d+季/.test(item.name))
    );
    
    console.log('找到的季文件夹:', seasonFolders.map(f => f.name));
    
    // 提取季号并排序
    seasonFolders.forEach(folder => {
      const seasonMatch = folder.name.match(/(season\s*|s)(\d+)|(第)(\d+)(季)/i);
      if (seasonMatch) {
        const seasonNumber = parseInt(seasonMatch[2] || seasonMatch[4]);
        if (!isNaN(seasonNumber)) {
          seasons.push({
            number: seasonNumber,
            name: folder.name,
            path: path.join(tvShowPath, folder.name)
          });
        }
      }
    });
    
    // 按季号排序
    seasons.sort((a, b) => a.number - b.number);
    
    console.log('解析后的季列表:', seasons);
    
    // 如果没有找到季文件夹，检查是否有视频文件直接存在，假设只有一季
    if (seasons.length === 0) {
      console.log('未找到季文件夹，检查是否有直接的文件...');
      const allFiles = fs.readdirSync(tvShowPath, { withFileTypes: true });
      const videoFiles = allFiles.filter(item => 
        item.isFile() && 
        ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'].some(ext => 
          item.name.toLowerCase().endsWith(ext)
        )
      );
      
      // 也检查是否有 .nfo 文件（作为剧集指示）
      const nfoFiles = allFiles.filter(item => 
        item.isFile() && 
        item.name.toLowerCase().endsWith('.nfo')
      );
      
      if (videoFiles.length > 0 || nfoFiles.length > 0) {
        console.log(`在根目录找到 ${videoFiles.length} 个视频文件和 ${nfoFiles.length} 个nfo文件，假设为第1季`);
        seasons.push({
          number: 1,
          name: 'Season 1',
          path: tvShowPath
        });
      }
    }
    
  } catch (error) {
    console.error(`扫描季列表出错: ${tvShowPath}`, error);
  }
  
  return seasons;
}

// 测试路径
const testPath = 'E:\\Sync\\smb\\TV\\mono女孩 (2025)';
console.log('测试路径:', testPath);
console.log('扫描结果:', scanSeasons(testPath));