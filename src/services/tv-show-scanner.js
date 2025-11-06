const fs = require('fs');
const path = require('path');
const { DOMParser } = require('@xmldom/xmldom');

class TvShowScanner {
  constructor() {
    this.videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'];
    this.subtitleExtensions = ['.srt', '.vtt', '.ass', '.ssa', '.sub'];
  }

  scanTvShows(folderPath) {
    const tvShows = [];
    
    try {
      const items = fs.readdirSync(folderPath, { withFileTypes: true });
      
      for (const item of items) {
        if (item.isDirectory() && !item.name.startsWith('.')) {
          const tvShowPath = path.join(folderPath, item.name);
          const posterPath = this.findPoster(tvShowPath);
          const firstEpisode = this.findFirstEpisode(tvShowPath);
          const premiered = this.getTvShowPremiered(tvShowPath);
          
          tvShows.push({
            name: item.name,
            path: tvShowPath,
            poster: posterPath,
            firstEpisode: firstEpisode,
            premiered: premiered
          });
        }
      }
    } catch (error) {
      console.error('扫描文件夹出错:', error);
    }
    
    return tvShows;
  }

  getTvShowPremiered(tvShowPath) {
    try {
      // 查找电视剧文件夹中的tvshow.nfo文件
      const nfoFiles = fs.readdirSync(tvShowPath, { withFileTypes: true })
        .filter(item => item.isFile() && item.name.toLowerCase().endsWith('.nfo'));
      
      for (const nfoFile of nfoFiles) {
        if (nfoFile.name.toLowerCase() === 'tvshow.nfo') {
          const nfoPath = path.join(tvShowPath, nfoFile.name);
          return this.parsePremieredFromNfo(nfoPath);
        }
      }
      
      // 如果没有tvshow.nfo，尝试查找其他nfo文件
      for (const nfoFile of nfoFiles) {
        const nfoPath = path.join(tvShowPath, nfoFile.name);
        const premiered = this.parsePremieredFromNfo(nfoPath);
        if (premiered) {
          return premiered;
        }
      }
      
      return null;
    } catch (error) {
      console.error(`读取电视剧NFO文件出错: ${tvShowPath}`, error);
      return null;
    }
  }

  parsePremieredFromNfo(nfoPath) {
    try {
      const xmlContent = fs.readFileSync(nfoPath, 'utf8');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
      
      // 尝试获取premiered字段
      const premieredElements = xmlDoc.getElementsByTagName('premiered');
      if (premieredElements.length > 0) {
        const premieredText = premieredElements[0].textContent.trim();
        if (premieredText) {
          return premieredText;
        }
      }
      
      // 备选方案：查找aired或year字段
      const airedElements = xmlDoc.getElementsByTagName('aired');
      if (airedElements.length > 0) {
        const airedText = airedElements[0].textContent.trim();
        if (airedText) {
          return airedText;
        }
      }
      
      const yearElements = xmlDoc.getElementsByTagName('year');
      if (yearElements.length > 0) {
        const yearText = yearElements[0].textContent.trim();
        if (yearText) {
          return `${yearText}-01-01`; // 如果只有年份，设置为1月1日
        }
      }
      
      return null;
    } catch (error) {
      console.error(`解析NFO文件出错: ${nfoPath}`, error);
      return null;
    }
  }

  scanSeasons(tvShowPath) {
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
      console.log('解析后的季列表:', seasons);
      
      if (seasons.length === 0) {
        console.log('未找到季文件夹，检查是否有直接的文件...');
        const allFiles = fs.readdirSync(tvShowPath, { withFileTypes: true });
        const videoFiles = allFiles.filter(item => 
          item.isFile() && 
          this.videoExtensions.some(ext => 
            item.name.toLowerCase().endsWith(ext)
          )
        );
        
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

  scanEpisodes(tvShowPath, season) {
    const episodes = [];
    
    try {
      let seasonPath = tvShowPath;
      if (season === 1) {
        const season1Path = path.join(tvShowPath, 'Season 1');
        if (fs.existsSync(season1Path)) {
          seasonPath = season1Path;
        }
      } else if (season > 1) {
        const seasons = this.scanSeasons(tvShowPath);
        const targetSeason = seasons.find(s => s.number === season);
        if (targetSeason) {
          seasonPath = targetSeason.path;
        }
      }
      
      const items = fs.readdirSync(seasonPath, { withFileTypes: true });
      
      const processedEpisodes = new Map();
      const nfoFiles = items.filter(item => item.isFile() && item.name.toLowerCase().endsWith('.nfo'));
      
      console.log(`找到 ${nfoFiles.length} 个 nfo 文件`);
      
      nfoFiles.forEach(nfoItem => {
        const nfoPath = path.join(seasonPath, nfoItem.name);
        
        try {
          let episodeNumber = null;
          const name = nfoItem.name.toLowerCase();
          
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
              console.log(`nfo文件 ${nfoItem.name} 匹配模式 ${pattern}，提取集号: ${episodeNumber}`);
              break;
            }
          }
          
          if (episodeNumber === null) {
            const numberMatch = name.match(/(\d{1,3})/);
            if (numberMatch) {
              episodeNumber = parseInt(numberMatch[1]);
              console.log(`nfo文件 ${nfoItem.name} 使用宽松匹配，提取集号: ${episodeNumber}`);
            }
          }
          
          if (episodeNumber !== null) {
            const baseName = nfoItem.name.replace('.nfo', '');
            const videoFile = items.find(item => 
              item.isFile() && 
              item.name.startsWith(baseName) &&
              this.videoExtensions.some(ext => item.name.toLowerCase().endsWith(ext))
            );
            
            // 解析nfo文件中的title
            const episodeTitle = this.parseEpisodeTitleFromNfo(nfoPath);
            
            if (videoFile) {
              processedEpisodes.set(episodeNumber, {
                number: episodeNumber,
                name: episodeTitle || baseName,
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
      
      if (processedEpisodes.size === 0) {
        console.log('未找到有效的nfo文件，扫描视频文件...');
      }
      
      const videoFiles = items
        .filter(item => item.isFile() && 
          this.videoExtensions.some(ext => item.name.toLowerCase().endsWith(ext)))
        .filter(item => {
          const baseName = item.name.replace(/\.[^.]+$/, '');
          const existingEpisode = Array.from(processedEpisodes.values()).find(
            ep => ep.path === path.join(seasonPath, item.name)
          );
          return !existingEpisode;
        })
        .map(item => {
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
      
      videoFiles.forEach(file => {
        if (!processedEpisodes.has(file.number)) {
          processedEpisodes.set(file.number, file);
        }
      });
      
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

  parseEpisodeTitleFromNfo(nfoPath) {
    try {
      const xmlContent = fs.readFileSync(nfoPath, 'utf8');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
      
      // 尝试获取title字段
      const titleElements = xmlDoc.getElementsByTagName('title');
      if (titleElements.length > 0) {
        const titleText = titleElements[0].textContent.trim();
        if (titleText) {
          return titleText;
        }
      }
      
      // 备选方案：查找episode节点下的title
      const episodeElements = xmlDoc.getElementsByTagName('episode');
      if (episodeElements.length > 0) {
        const titleElements = episodeElements[0].getElementsByTagName('title');
        if (titleElements.length > 0) {
          const titleText = titleElements[0].textContent.trim();
          if (titleText) {
            return titleText;
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error(`解析剧集NFO文件出错: ${nfoPath}`, error);
      return null;
    }
  }

  findPoster(tvShowPath) {
    try {
      const items = fs.readdirSync(tvShowPath);
      
      const posterFile = items.find(item => 
        item.toLowerCase() === 'poster.jpg' || 
        item.toLowerCase() === 'poster.png'
      );
      
      if (posterFile) {
        return path.join(tvShowPath, posterFile);
      }
      
      const thumbFile = items.find(item => 
        item.toLowerCase().includes('-thumb.jpg')
      );
      
      if (thumbFile) {
        return path.join(tvShowPath, thumbFile);
      }
      
      return null;
    } catch (error) {
      console.error(`查找海报出错: ${tvShowPath}`, error);
      return null;
    }
  }

  findFirstEpisode(tvShowPath) {
    try {
      const season1Path = path.join(tvShowPath, 'Season 1');
      if (fs.existsSync(season1Path) && fs.statSync(season1Path).isDirectory()) {
        return this.findFirstVideoFile(season1Path);
      }
      
      const items = fs.readdirSync(tvShowPath, { withFileTypes: true });
      const seasonFolders = items.filter(item => 
        item.isDirectory() && 
        (item.name.toLowerCase().includes('season') || 
         item.name.toLowerCase().includes('s01') ||
         item.name.toLowerCase().includes('第一季') ||
         /^season\s*1$/i.test(item.name) ||
         /^s1$/i.test(item.name))
      );
      
      if (seasonFolders.length > 0) {
        seasonFolders.sort((a, b) => a.name.localeCompare(b.name));
        const firstSeasonPath = path.join(tvShowPath, seasonFolders[0].name);
        return this.findFirstVideoFile(firstSeasonPath);
      }
      
      return this.findFirstVideoFile(tvShowPath);
    } catch (error) {
      console.error(`查找第一集出错: ${tvShowPath}`, error);
      return null;
    }
  }

  findFirstVideoFile(folderPath) {
    try {
      const items = fs.readdirSync(folderPath, { withFileTypes: true });
      
      const videoFiles = items
        .filter(item => item.isFile() && 
          this.videoExtensions.some(ext => item.name.toLowerCase().endsWith(ext)))
        .map(item => item.name)
        .sort((a, b) => a.localeCompare(b));
      
      if (videoFiles.length > 0) {
        return path.join(folderPath, videoFiles[0]);
      }
      
      return null;
    } catch (error) {
      console.error(`查找视频文件出错: ${folderPath}`, error);
      return null;
    }
  }

  scanExternalSubtitles(videoPath) {
    const subtitles = [];
    
    try {
      const dirPath = path.dirname(videoPath);
      const videoName = path.basename(videoPath, path.extname(videoPath));
      const files = fs.readdirSync(dirPath, { withFileTypes: true });
      
      console.log(`扫描字幕文件，视频名称: ${videoName}`);
      console.log('目录中的文件:', files.map(f => f.name));
      
      const subtitleFiles = files.filter(item => {
        if (!item.isFile()) return false;
        
        const fileName = item.name;
        const fileExt = path.extname(fileName).toLowerCase();
        const baseName = path.basename(fileName, fileExt);
        
        if (!this.subtitleExtensions.includes(fileExt)) return false;
        
        return baseName.startsWith(videoName) && 
               (baseName === videoName || baseName === `${videoName}.0` || baseName === `${videoName}.1`);
      });
      
      subtitleFiles.forEach(file => {
        const filePath = path.join(dirPath, file.name);
        const fileExt = path.extname(file.name).toLowerCase();
        const fileName = file.name;
        
        let type = '';
        switch (fileExt) {
          case '.srt':
            type = 'SRT';
            break;
          case '.vtt':
            type = 'VTT';
            break;
          case '.ass':
            type = 'ASS';
            break;
          case '.ssa':
            type = 'SSA';
            break;
          case '.sub':
            type = 'SUB';
            break;
          default:
            type = fileExt.toUpperCase().replace('.', '');
        }
        
        subtitles.push({
          name: fileName,
          path: filePath,
          type: type,
          language: this.detectSubtitleLanguage(fileName)
        });
      });
      
      subtitles.sort((a, b) => a.type.localeCompare(b.type));
      
      console.log(`找到 ${subtitles.length} 个外部字幕文件`);
      
    } catch (error) {
      console.error('扫描外部字幕文件出错:', error);
      throw error;
    }
    
    return subtitles;
  }

  detectSubtitleLanguage(fileName) {
    const name = fileName.toLowerCase();
    
    const languagePatterns = [
      { pattern: /[一-鿿]|chinese|chs|cht|zh/, language: '中文' },
      { pattern: /english|eng|en/, language: 'English' },
      { pattern: /japanese|jpn|jp/, language: '日本語' },
      { pattern: /korean|kor|ko/, language: '한국어' },
      { pattern: /french|fre|fr/, language: 'Français' },
      { pattern: /german|ger|de/, language: 'Deutsch' },
      { pattern: /spanish|spa|es/, language: 'Español' },
      { pattern: /russian|rus|ru/, language: 'Русский' }
    ];
    
    for (const lang of languagePatterns) {
      if (lang.pattern.test(name)) {
        return lang.language;
      }
    }
    
    return '未知';
  }
}

module.exports = TvShowScanner;