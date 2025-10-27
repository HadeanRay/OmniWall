const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 使用 fluent-ffmpeg 的改进字幕提取方法
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

ffmpeg.setFfmpegPath(ffmpegPath);

class SubtitleManager {
  constructor() {
    this.videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'];
    this.ffmpegPath = null;
    this.ffprobePath = null;
    this.subtitleCache = new Map(); // 内存缓存
    this.cacheFile = null; // 缓存文件路径
    this.isInitialized = false;
    
    // 初始化缓存文件路径
    this.initCacheFile();
    // 预加载缓存数据
    this.loadCacheFromFile();
    // 预初始化FFmpeg路径
    this.preInitializePaths();
  }

  // 初始化缓存文件路径
  initCacheFile() {
    const userHome = os.homedir();
    const cacheDir = path.join(userHome, '.omniwall', 'cache');
    
    try {
      // 确保缓存目录存在
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      
      this.cacheFile = path.join(cacheDir, 'subtitle-cache.json');
      console.log('字幕缓存文件路径:', this.cacheFile);
    } catch (error) {
      console.error('初始化缓存目录失败:', error.message);
      // 如果无法创建缓存目录，使用临时缓存
      this.cacheFile = null;
    }
  }

  // 从文件加载缓存
  loadCacheFromFile() {
    if (!this.cacheFile) return;
    
    try {
      if (fs.existsSync(this.cacheFile)) {
        const cacheData = fs.readFileSync(this.cacheFile, 'utf8');
        const parsedCache = JSON.parse(cacheData);
        
        // 将缓存数据加载到内存中
        Object.entries(parsedCache).forEach(([key, value]) => {
          this.subtitleCache.set(key, value);
        });
        
        console.log(`从缓存文件加载了 ${Object.keys(parsedCache).length} 个缓存项`);
      }
    } catch (error) {
      console.error('加载字幕缓存文件失败:', error.message);
    }
  }

  // 保存缓存到文件
  saveCacheToFile() {
    if (!this.cacheFile) return;
    
    try {
      const cacheObj = Object.fromEntries(this.subtitleCache);
      const cacheData = JSON.stringify(cacheObj, null, 2);
      fs.writeFileSync(this.cacheFile, cacheData, 'utf8');
      console.log(`字幕缓存已保存到文件，共 ${this.subtitleCache.size} 个缓存项`);
    } catch (error) {
      console.error('保存字幕缓存文件失败:', error.message);
    }
  }

  // 获取缓存键
  getCacheKey(videoFile, customFfmpegPath) {
    try {
      const fileStat = fs.statSync(videoFile);
      const fileInfo = `${videoFile}_${fileStat.size}_${fileStat.mtimeMs}`;
      return `${fileInfo}_${customFfmpegPath || 'default'}`;
    } catch (error) {
      // 如果文件不存在或无法访问，使用文件名作为缓存键
      return `${videoFile}_${customFfmpegPath || 'default'}`;
    }
  }

  // 清理过期缓存
  cleanupExpiredCache() {
    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30天
    
    for (const [key, value] of this.subtitleCache.entries()) {
      if (value.timestamp && now - value.timestamp > maxAge) {
        this.subtitleCache.delete(key);
        console.log(`清理过期缓存: ${key}`);
      }
    }
    
    this.saveCacheToFile();
  }

  // 手动清除缓存
  clearCache() {
    this.subtitleCache.clear();
    if (this.cacheFile && fs.existsSync(this.cacheFile)) {
      fs.unlinkSync(this.cacheFile);
    }
    console.log('字幕缓存已清除');
  }

  // 预初始化FFmpeg和FFprobe路径，避免重复加载模块
  preInitializePaths() {
    if (this.isInitialized) return;
    
    // 预加载FFmpeg路径
    this.ffmpegPath = this.getFfmpegPath(null);
    // 预加载FFprobe路径  
    this.ffprobePath = this.getFfprobePath(null);
    
    this.isInitialized = true;
    console.log('SubtitleManager 预初始化完成');
  }

  async extractSubtitlesFromFolder(folderPath, customFfmpegPath, progressCallback) {
    const videoFiles = this.findVideoFilesRecursive(folderPath);
    
    console.log(`找到 ${videoFiles.length} 个视频文件`);
    progressCallback({
      status: 'scanning',
      total: videoFiles.length
    });
    
    if (videoFiles.length === 0) {
      throw new Error('未找到视频文件');
    }
    
    let processed = 0;
    let successCount = 0;
    
    // 限制并发数，避免同时处理太多文件
    const concurrencyLimit = 3;
    const batches = [];
    for (let i = 0; i < videoFiles.length; i += concurrencyLimit) {
      batches.push(videoFiles.slice(i, i + concurrencyLimit));
    }
    
    for (const batch of batches) {
      const batchPromises = batch.map(async (videoFile) => {
        const fileName = path.basename(videoFile);
        const baseName = path.basename(videoFile, path.extname(videoFile));
        const dirPath = path.dirname(videoFile);
        const fileExt = path.extname(videoFile).toLowerCase();
        
        console.log(`处理视频文件: ${fileName} (${fileExt})`);
        
        try {
          // 针对不同格式使用不同的检测策略
          let subtitleStreams = await this.getSubtitleStreams(videoFile, customFfmpegPath);
          console.log(`视频 ${fileName} 包含 ${subtitleStreams.length} 个字幕流`);
          
          // 如果MP4文件没有检测到字幕流，尝试使用fluent-ffmpeg方法
          if (fileExt === '.mp4' && subtitleStreams.length === 0) {
            console.log(`MP4文件未检测到字幕流，尝试使用fluent-ffmpeg检测...`);
            try {
              const streamsInfo = await SubtitleManager.getSubtitleStreamsInfo(videoFile);
              subtitleStreams = streamsInfo.map(stream => stream.streamIndex);
              console.log(`fluent-ffmpeg检测到字幕流: ${subtitleStreams.join(', ')}`);
            } catch (fluentError) {
              console.log(`fluent-ffmpeg检测失败: ${fluentError.message}`);
            }
          }
          
          let fileSuccessCount = 0;
          
          if (subtitleStreams.length > 0) {
            for (let i = 0; i < subtitleStreams.length; i++) {
              const outputFile = path.join(dirPath, `${baseName}.${i}.vtt`);
              
              if (fs.existsSync(outputFile)) {
                console.log(`字幕文件已存在: ${outputFile}`);
                continue;
              }
              
              // 针对MP4文件使用fluent-ffmpeg提取
              let success;
              if (fileExt === '.mp4') {
                try {
                  success = await SubtitleManager.extractSubtitleStream(videoFile, i, outputFile);
                  console.log(`fluent-ffmpeg提取结果: ${success ? '成功' : '失败'}`);
                } catch (extractError) {
                  console.log(`fluent-ffmpeg提取失败，回退到spawn方法: ${extractError.message}`);
                  success = await this.extractSubtitleStream(videoFile, i, outputFile, customFfmpegPath);
                }
              } else {
                success = await this.extractSubtitleStream(videoFile, i, outputFile, customFfmpegPath);
              }
              
              if (success) {
                console.log(`成功提取字幕: ${outputFile}`);
                fileSuccessCount++;
              } else {
                console.log(`提取字幕失败: ${outputFile}`);
              }
            }
          } else {
            console.log(`视频 ${fileName} 没有字幕流`);
          }
          
          return fileSuccessCount;
        } catch (error) {
          console.error(`处理视频文件 ${fileName} 时出错:`, error);
          return 0;
        } finally {
          processed++;
          progressCallback({
            status: 'processing',
            current: processed,
            total: videoFiles.length,
            currentFile: fileName
          });
        }
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          successCount += result.value;
        }
      }
    }
    
    progressCallback({
      status: 'completed',
      processed: processed,
      success: successCount
    });
  }

  findVideoFilesRecursive(dir, fileList = []) {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      
      if (item.isDirectory()) {
        this.findVideoFilesRecursive(fullPath, fileList);
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        if (this.videoExtensions.includes(ext)) {
          fileList.push(fullPath);
        }
      }
    }
    
    return fileList;
  }

  getFfmpegPath(customFfmpegPath) {
    // 如果已预初始化且没有自定义路径，返回缓存的路径
    if (this.isInitialized && !customFfmpegPath && this.ffmpegPath) {
      return this.ffmpegPath;
    }
    
    if (customFfmpegPath) {
      console.log('使用用户指定的ffmpeg路径:', customFfmpegPath);
      return customFfmpegPath;
    }
    
    const ffmpegPath = 'ffmpeg';
    
    try {
      const ffmpegStatic = require('ffmpeg-static');
      if (ffmpegStatic) {
        console.log('使用ffmpeg-static包中的ffmpeg');
        return ffmpegStatic;
      }
    } catch (error) {
      console.log('ffmpeg-static包不可用，使用系统PATH中的ffmpeg');
    }
    
    return ffmpegPath;
  }

  getFfprobePath(customFfmpegPath) {
    // 如果已预初始化且没有自定义路径，返回缓存的路径
    if (this.isInitialized && !customFfmpegPath && this.ffprobePath) {
      return this.ffprobePath;
    }
    
    if (customFfmpegPath) {
      // 如果用户指定了ffmpeg路径，尝试推断ffprobe路径
      const customFfprobePath = customFfmpegPath.replace('ffmpeg', 'ffprobe');
      console.log('使用推断的ffprobe路径:', customFfprobePath);
      return customFfprobePath;
    }
    
    const ffprobePath = 'ffprobe';
    
    try {
      const ffprobeStatic = require('@ffprobe-installer/ffprobe');
      if (ffprobeStatic && ffprobeStatic.path) {
        console.log('使用ffprobe-installer包中的ffprobe');
        return ffprobeStatic.path;
      }
    } catch (error) {
      console.log('ffprobe-installer包不可用，尝试其他方式');
    }
    
    // 尝试从ffmpeg-static推断ffprobe
    try {
      const ffmpegStatic = require('ffmpeg-static');
      if (ffmpegStatic) {
        const inferredPath = ffmpegStatic.replace('ffmpeg', 'ffprobe');
        console.log('使用从ffmpeg-static推断的ffprobe路径:', inferredPath);
        return inferredPath;
      }
    } catch (error) {
      console.log('无法推断ffprobe路径，使用系统PATH中的ffprobe');
    }
    
    return ffprobePath;
  }

  async getSubtitleStreams(videoFile, customFfmpegPath) {
    // 检查缓存
    const cacheKey = this.getCacheKey(videoFile, customFfmpegPath);
    if (this.subtitleCache.has(cacheKey)) {
      const cacheEntry = this.subtitleCache.get(cacheKey);
      console.log(`从缓存中获取字幕流信息: ${videoFile}`);
      return cacheEntry.streams;
    }

    const ffprobePath = this.getFfprobePath(customFfmpegPath);
    
    // 使用单一高效的ffprobe命令，不再尝试多个参数组合
    const probeArgs = [
      '-v', 'quiet',
      '-select_streams', 's',
      '-show_entries', 'stream=index,codec_type',
      '-of', 'json',
      videoFile
    ];
    
    console.log(`使用ffprobe检测字幕流: ${ffprobePath} ${probeArgs.join(' ')}`);
    
    try {
      const subtitleStreams = await new Promise((resolve, reject) => {
        const ffprobe = spawn(ffprobePath, probeArgs);
        
        let stdout = '';
        let stderr = '';
        let timeoutId;
        
        // 设置超时（10秒）
        timeoutId = setTimeout(() => {
          ffprobe.kill();
          reject(new Error('ffprobe检测超时'));
        }, 10000);
        
        ffprobe.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        ffprobe.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        ffprobe.on('close', (code) => {
          clearTimeout(timeoutId);
          if (code === 0 && stdout.trim()) {
            try {
              const metadata = JSON.parse(stdout);
              const streams = metadata.streams
                ? metadata.streams
                    .filter(stream => stream.codec_type === 'subtitle')
                    .map(stream => stream.index)
                : [];
              console.log(`ffprobe找到字幕流: ${streams.join(', ')}`);
              resolve(streams);
            } catch (parseError) {
              console.error('JSON解析失败:', parseError);
              resolve([]);
            }
          } else {
            console.log(`ffprobe未找到字幕流，退出码: ${code}`);
            resolve([]);
          }
        });
        
        ffprobe.on('error', (error) => {
          clearTimeout(timeoutId);
          console.error(`ffprobe失败: ${error.message}`);
          resolve([]);
        });
      });
      
      // 缓存结果并保存到文件
      const cacheEntry = {
        streams: subtitleStreams,
        timestamp: Date.now()
      };
      this.subtitleCache.set(cacheKey, cacheEntry);
      this.saveCacheToFile();
      return subtitleStreams;
      
    } catch (error) {
      console.error(`ffprobe检测失败: ${error.message}`);
      // 回退到备用方法
      console.log('ffprobe失败，回退到使用ffmpeg检测...');
      const fallbackStreams = await this.fallbackGetSubtitleStreams(videoFile, customFfmpegPath);
      // 缓存回退结果并保存到文件
      const cacheEntry = {
        streams: fallbackStreams,
        timestamp: Date.now()
      };
      this.subtitleCache.set(cacheKey, cacheEntry);
      this.saveCacheToFile();
      return fallbackStreams;
    }
  }

  fallbackGetSubtitleStreams(videoFile, customFfmpegPath) {
    return new Promise((resolve, reject) => {
      const ffmpegPath = this.getFfmpegPath(customFfmpegPath);
      
      const ffmpeg = spawn(ffmpegPath, [
        '-i', videoFile,
        '-hide_banner'
      ]);
      
      let stderr = '';
      let timeoutId;
      
      // 设置超时（15秒）
      timeoutId = setTimeout(() => {
        ffmpeg.kill();
        console.log('ffmpeg检测超时');
        resolve([]);
      }, 15000);
      
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      ffmpeg.on('close', (code) => {
        clearTimeout(timeoutId);
        console.log(`ffmpeg流信息输出: ${stderr}`);
        
        const subtitleStreams = [];
        
        // 改进的字幕流匹配模式，支持更多格式
        const streamRegexes = [
          /Stream #(\d+):(\d+)(?:\([^)]+\))?: Subtitle:\s*([^\n]+)/g,  // 标准格式
          /Stream #(\d+):(\d+): Subtitle:\s*([^\n]+)/g,                   // 简化格式
          /Stream #(\d+):(\d+)(?:\[0x\w+\])?: Subtitle:\s*([^\n]+)/g,     // 包含十六进制标识
          /Stream #(\d+):(\d+)(?:\([^)]+\))?: Data:\s*([^\n]+)/g         // 数据流格式（某些MP4）
        ];
        
        for (const regex of streamRegexes) {
          let match;
          while ((match = regex.exec(stderr)) !== null) {
            const streamIndex = parseInt(match[2]);
            if (!subtitleStreams.includes(streamIndex)) {
              subtitleStreams.push(streamIndex);
              console.log(`ffmpeg找到字幕流: ${streamIndex}, 详细信息: ${match[3]}`);
            }
          }
        }
        
        // 备用简单匹配
        if (subtitleStreams.length === 0) {
          const simpleRegex = /Stream #\d+:(\d+)(?:\([^)]+\))?: Subtitle/g;
          let simpleMatch;
          while ((simpleMatch = simpleRegex.exec(stderr)) !== null) {
            const streamIndex = parseInt(simpleMatch[1]);
            if (!subtitleStreams.includes(streamIndex)) {
              subtitleStreams.push(streamIndex);
              console.log(`ffmpeg找到字幕流(简单匹配): ${streamIndex}`);
            }
          }
        }
        
        // 尝试检测数据流中的字幕
        if (subtitleStreams.length === 0) {
          const dataStreamRegex = /Stream #\d+:(\d+).*?: Data:.*?(subtitle|text)/gi;
          let dataMatch;
          while ((dataMatch = dataStreamRegex.exec(stderr)) !== null) {
            const streamIndex = parseInt(dataMatch[1]);
            if (!subtitleStreams.includes(streamIndex)) {
              subtitleStreams.push(streamIndex);
              console.log(`ffmpeg找到数据流中的字幕: ${streamIndex}`);
            }
          }
        }
        
        console.log(`总共找到字幕流: ${subtitleStreams.length} 个`);
        resolve(subtitleStreams);
      });
      
      ffmpeg.on('error', (error) => {
        clearTimeout(timeoutId);
        console.error(`ffmpeg检测失败: ${error.message}`);
        resolve([]);
      });
    });
  }

  extractSubtitleStream(videoFile, streamIndex, outputFile, customFfmpegPath) {
    return new Promise((resolve, reject) => {
      const ffmpegPath = this.getFfmpegPath(customFfmpegPath);
      
      // 使用最常用的参数组合，减少重试次数
      const args = [
        '-i', videoFile,
        '-map', `0:s:${streamIndex}`,
        '-c:s', 'webvtt',
        '-y',
        '-hide_banner',
        '-loglevel', 'error',
        outputFile
      ];
      
      console.log(`提取字幕流 ${streamIndex}: ${ffmpegPath} ${args.join(' ')}`);
      
      const ffmpeg = spawn(ffmpegPath, args);
      let timeoutId;
      
      // 设置超时（30秒）
      timeoutId = setTimeout(() => {
        ffmpeg.kill();
        console.error(`字幕提取超时: ${videoFile}`);
        reject(new Error('字幕提取超时'));
      }, 30000);
      
      ffmpeg.on('close', (code) => {
        clearTimeout(timeoutId);
        if (code === 0) {
          console.log(`字幕提取成功: ${outputFile}`);
          resolve(true);
        } else {
          console.error(`字幕提取失败，退出码: ${code}`);
          resolve(false);
        }
      });
      
      ffmpeg.on('error', (error) => {
        clearTimeout(timeoutId);
        console.error(`提取字幕时出错: ${error.message}`);
        resolve(false);
      });
    });
  }

  /**
   * 使用 fluent-ffmpeg 提取视频中的所有字幕轨道为 VTT 格式
   */
  static async extractAllSubtitles(inputFile, outputDir = '.') {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputFile, (err, metadata) => {
        if (err) {
          reject(new Error(`无法分析视频文件: ${err.message}`));
          return;
        }

        const subtitleStreams = metadata.streams.filter(
          stream => stream.codec_type === 'subtitle'
        );

        if (subtitleStreams.length === 0) {
          reject(new Error('视频中未找到字幕轨道'));
          return;
        }

        console.log(`🎬 找到 ${subtitleStreams.length} 个字幕轨道，开始提取...`);

        const baseName = path.basename(inputFile, path.extname(inputFile));
        const extractPromises = [];
        const successFiles = [];

        subtitleStreams.forEach((stream, index) => {
          const outputFile = path.join(outputDir, `${baseName}.${index}.vtt`);
          
          const extractPromise = new Promise((resolveExtract, rejectExtract) => {
            console.log(`⏳ 正在提取第 ${index} 个字幕轨道...`);
            
            ffmpeg(inputFile)
              .outputOption(`-map 0:s:${index}`)
              .outputOption('-c:s webvtt')
              .on('end', () => {
                try {
                  if (fs.existsSync(outputFile)) {
                    const stats = fs.statSync(outputFile);
                    console.log(`✅ 成功生成: ${outputFile} (${stats.size} bytes)`);
                    successFiles.push({
                      index: index,
                      filePath: outputFile,
                      size: stats.size,
                      codec_name: stream.codec_name,
                      language: stream.tags?.language || 'unknown'
                    });
                    resolveExtract();
                  } else {
                    rejectExtract(new Error(`文件未生成: ${outputFile}`));
                  }
                } catch (fileErr) {
                  rejectExtract(fileErr);
                }
              })
              .on('error', (extractErr) => {
                rejectExtract(new Error(`提取第 ${index} 个字幕轨道失败: ${extractErr.message}`));
              })
              .save(outputFile);
          });

          extractPromises.push(extractPromise);
        });

        Promise.all(extractPromises)
          .then(() => {
            console.log('🎉 所有字幕轨道提取完成!');
            resolve(successFiles);
          })
          .catch((promiseErr) => {
            reject(promiseErr);
          });
      });
    });
  }

  /**
   * 获取视频中的字幕流信息
   */
  static async getSubtitleStreamsInfo(inputFile) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputFile, (err, metadata) => {
        if (err) {
          reject(new Error(`无法分析视频文件: ${err.message}`));
          return;
        }

        const subtitleStreams = metadata.streams
          .filter(stream => stream.codec_type === 'subtitle')
          .map((stream, index) => ({
            index: index,
            streamIndex: stream.index,
            codec_name: stream.codec_name,
            language: stream.tags?.language || 'unknown',
            title: stream.tags?.title || '',
            duration: stream.duration,
            bit_rate: stream.bit_rate
          }));

        resolve(subtitleStreams);
      });
    });
  }

  /**
   * 提取并保存单个字幕轨道
   */
  static async extractSubtitleStream(inputFile, streamIndex, outputFile) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputFile)
        .outputOption(`-map 0:s:${streamIndex}`)
        .outputOption('-c:s webvtt')
        .on('end', () => {
          if (fs.existsSync(outputFile)) {
            console.log(`✅ 字幕提取成功: ${outputFile}`);
            resolve(true);
          } else {
            reject(new Error(`字幕文件未生成: ${outputFile}`));
          }
        })
        .on('error', (err) => {
          reject(new Error(`提取字幕失败: ${err.message}`));
        })
        .save(outputFile);
    });
  }
}

module.exports = SubtitleManager;