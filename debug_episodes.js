const fs = require('fs');
const path = require('path');

// 测试集数扫描逻辑
function scanEpisodes(tvShowPath, season) {
  const episodes = [];
  const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'];
  
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
      const seasons = scanSeasons(tvShowPath);
      const targetSeason = seasons.find(s => s.number === season);
      if (targetSeason) {
        seasonPath = targetSeason.path;
      }
    }
    
    const items = fs.readdirSync(seasonPath, { withFileTypes: true });
    
    // 首先处理 .nfo 文件，获取更准确的剧集信息
    const processedEpisodes = new Map();
    const nfoFiles = items.filter(item => item.isFile() && item.name.toLowerCase().endsWith('.nfo'));
    
    console.log(`找到 ${nfoFiles.length} 个 nfo 文件`);
    
    // 处理所有nfo文件
    nfoFiles.forEach(nfoItem => {
      const nfoPath = path.join(seasonPath, nfoItem.name);
      
      try {
        // 从nfo文件名中提取集号
        let episodeNumber = null;
        const name = nfoItem.name.toLowerCase();
        
        // 匹配各种集号格式（按优先级从高到低排序）
        const patterns = [
          /s\d{1,2}e(\d{1,3})/i,      // S01E01
          /\[(\d{1,3})\]/,            // [01] 或 [1]
          /第(\d{1,3})[集话]/,        // 第01集、第01话
          /-(\d{1,3})v\d/,            // -01v1 格式
          /-\s*(\d{1,3})v\d/,         // - 01v1 格式（带空格）
          /-\s*(\d{1,3})\s*[\[\-]/,  // - 01 [ 或 - 01 -
          /(\d{1,3})\s*-\s*/,         // 01 -
          /-\s*(\d{1,3})\s*\./,      // - 01 .
          /\s(\d{1,3})\s*[\-\[]/,     // 空格 01 空格 [
          /(\d{1,3})\s*-\s*/,         // 01 - 空格
          /-(\d{1,3})\s*[-\[]/,       // -01 [ 或 -01-
          /\[(\d{1,3})\][^\]]*$/,     // [01] 在末尾
          /^.*\[(\d{1,3})\]/,         // [01] 在任意位置
          /\b(\d{1,3})\b/,            // 直接的数字（最后尝试）
        ];
        
        for (const pattern of patterns) {
          const match = name.match(pattern);
          if (match && match[1]) {
            episodeNumber = parseInt(match[1]);
            console.log(`nfo文件 ${nfoItem.name} 匹配模式 ${pattern}，提取集号: ${episodeNumber}`);
            break;
          }
        }
        
        // 如果还是没找到，尝试更宽松的匹配
        if (episodeNumber === null) {
          const numberMatch = name.match(/(\d{1,3})/);
          if (numberMatch) {
            episodeNumber = parseInt(numberMatch[1]);
            console.log(`nfo文件 ${nfoItem.name} 使用宽松匹配，提取集号: ${episodeNumber}`);
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
              name: baseName, // 使用nfo文件名（不含扩展名）作为显示名称
              path: path.join(seasonPath, videoFile.name),
              nfoPath: nfoPath
            });
          } else {
            console.log(`nfo文件 ${nfoItem.name} 未找到对应的视频文件`);
          }
        }
      } catch (error) {
        console.error(`处理nfo文件失败: ${nfoPath}`, error);
      }
    });
    
    // 如果没有nfo文件，或者需要补充缺失的集数，扫描视频文件
    if (processedEpisodes.size === 0) {
      console.log('未找到有效的nfo文件，扫描视频文件...');
    }
    
    // 扫描剩余的视频文件（对于没有对应nfo文件的视频文件）
    const videoFiles = items
      .filter(item => item.isFile() && 
        videoExtensions.some(ext => item.name.toLowerCase().endsWith(ext)))
      .filter(item => {
        // 检查是否已经有对应的nfo文件处理过
        const baseName = item.name.replace(/\.[^.]+$/, ''); // 去除文件扩展名
        const existingEpisode = Array.from(processedEpisodes.values()).find(
          ep => ep.path === path.join(seasonPath, item.name)
        );
        return !existingEpisode;
      })
      .map(item => {
        // 从文件名中提取集号
        let episodeNumber = null;
        const name = item.name.toLowerCase();
        
        const patterns = [
          /s\d{1,2}e(\d{1,3})/i,
          /\[(\d{1,3})\]/,
          /第(\d{1,3})[集话]/,
          /-(\d{1,3})v\d/,
          /-\s*(\d{1,3})v\d/,
          /-\s*(\d{1,3})\s*[\[\-]/,
          /(\d{1,3})\s*-\s*/,
          /-\s*(\d{1,3})\s*\./,
          /\s(\d{1,3})\s*[\-\[]/,
          /(\d{1,3})\s*-\s*/,
          /-(\d{1,3})\s*[-\[]/,
          /\[(\d{1,3})\][^\]]*$/,
          /^.*\[(\d{1,3})\]/,
          /\b(\d{1,3})\b/,
        ];
        
        for (const pattern of patterns) {
          const match = name.match(pattern);
          if (match && match[1]) {
            episodeNumber = parseInt(match[1]);
            break;
          }
        }
        
        if (episodeNumber === null) {
          const numberMatch = name.match(/(\d{1,3})/);
          if (numberMatch) {
            episodeNumber = parseInt(numberMatch[1]);
          }
        }
        
        return {
          number: episodeNumber,
          name: item.name,
          path: path.join(seasonPath, item.name)
        };
      })
      .filter(file => file.number !== null);
    
    // 将视频文件添加到已处理的剧集中
    videoFiles.forEach(file => {
      if (!processedEpisodes.has(file.number)) {
        processedEpisodes.set(file.number, file);
      }
    });
    
    // 按集号排序并构建最终剧集列表
    const sortedEpisodes = Array.from(processedEpisodes.values()).sort((a, b) => a.number - b.number);
    
    console.log(`最终剧集列表:`, sortedEpisodes.map(f => ({ 
      number: f.number, 
      name: f.name,
      hasNfo: !!f.nfoPath 
    })));
    
    episodes.push(...sortedEpisodes);
    
  } catch (error) {
    console.error(`扫描集数出错: ${tvShowPath} 季 ${season}`, error);
  }
  
  return episodes;
}

// 需要先定义scanSeasons函数
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
    
    seasons.sort((a, b) => a.number - b.number);
    
  } catch (error) {
    console.error(`扫描季列表出错: ${tvShowPath}`, error);
  }
  
  return seasons;
}

// 测试路径
const testPath = 'E:\\Sync\\smb\\TV\\mono女孩 (2025)';
console.log('测试路径:', testPath);
console.log('第一季集数扫描结果:', scanEpisodes(testPath, 1));