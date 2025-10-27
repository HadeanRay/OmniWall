const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 使用 fluent-ffmpeg 的改进字幕提取方法
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

ffmpeg.setFfmpegPath(ffmpegPath);

class SubtitleManager {
  constructor() {
    this.videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'];
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
    
    for (const videoFile of videoFiles) {
      const fileName = path.basename(videoFile);
      const baseName = path.basename(videoFile, path.extname(videoFile));
      const dirPath = path.dirname(videoFile);
      const fileExt = path.extname(videoFile).toLowerCase();
      
      progressCallback({
        status: 'processing',
        current: processed + 1,
        total: videoFiles.length,
        currentFile: fileName
      });
      
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
              successCount++;
            } else {
              console.log(`提取字幕失败: ${outputFile}`);
            }
          }
        } else {
          console.log(`视频 ${fileName} 没有字幕流`);
        }
      } catch (error) {
        console.error(`处理视频文件 ${fileName} 时出错:`, error);
      }
      
      processed++;
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

  getSubtitleStreams(videoFile, customFfmpegPath) {
    return new Promise((resolve, reject) => {
      const ffprobePath = this.getFfprobePath(customFfmpegPath);
      
      const tryFfprobe = () => {
        return new Promise((resolveProbe) => {
          console.log(`尝试使用ffprobe路径: ${ffprobePath}`);
          
          // 尝试不同的ffprobe参数组合
          const probeAttempts = [
            [
              '-v', 'quiet',
              '-select_streams', 's',
              '-show_entries', 'stream=index',
              '-of', 'csv=p=0',
              videoFile
            ],
            // 针对MP4格式的备用参数
            [
              '-v', 'quiet',
              '-select_streams', 's',
              '-show_entries', 'stream=index,codec_type',
              '-of', 'json',
              videoFile
            ]
          ];
          
          const attemptProbe = (attemptIndex) => {
            if (attemptIndex >= probeAttempts.length) {
              resolveProbe(null);
              return;
            }
            
            const args = probeAttempts[attemptIndex];
            console.log(`尝试ffprobe参数组合 ${attemptIndex + 1}: ${args.join(' ')}`);
            
            const ffprobe = spawn(ffprobePath, args);
            
            let stdout = '';
            let stderr = '';
            
            ffprobe.stdout.on('data', (data) => {
              stdout += data.toString();
            });
            
            ffprobe.stderr.on('data', (data) => {
              stderr += data.toString();
            });
            
            ffprobe.on('close', (code) => {
              if (code === 0 && stdout.trim()) {
                let subtitleStreams = [];
                
                if (attemptIndex === 0) {
                  // CSV格式解析
                  subtitleStreams = stdout.trim().split('\n').map(line => {
                    const index = parseInt(line.trim());
                    return isNaN(index) ? null : index;
                  }).filter(index => index !== null);
                } else if (attemptIndex === 1) {
                  // JSON格式解析
                  try {
                    const metadata = JSON.parse(stdout);
                    if (metadata.streams) {
                      subtitleStreams = metadata.streams
                        .filter(stream => stream.codec_type === 'subtitle')
                        .map(stream => stream.index);
                    }
                  } catch (parseError) {
                    console.error('JSON解析失败:', parseError);
                  }
                }
                
                console.log(`ffprobe找到字幕流: ${subtitleStreams.join(', ')}`);
                resolveProbe(subtitleStreams);
              } else {
                console.log(`ffprobe参数组合 ${attemptIndex + 1} 未找到字幕流或失败`);
                attemptProbe(attemptIndex + 1);
              }
            });
            
            ffprobe.on('error', (error) => {
              console.error(`ffprobe失败: ${error.message}`);
              attemptProbe(attemptIndex + 1);
            });
          };
          
          // 开始第一次尝试
          attemptProbe(0);
        });
      };
      
      tryFfprobe().then(probeResult => {
        if (probeResult !== null && probeResult.length > 0) {
          resolve(probeResult);
        } else {
          console.log('所有ffprobe尝试都失败，回退到使用ffmpeg检测...');
          this.fallbackGetSubtitleStreams(videoFile, customFfmpegPath).then(resolve).catch(() => resolve([]));
        }
      });
    });
  }

  fallbackGetSubtitleStreams(videoFile, customFfmpegPath) {
    return new Promise((resolve, reject) => {
      const ffmpegPath = this.getFfmpegPath(customFfmpegPath);
      
      const ffmpeg = spawn(ffmpegPath, [
        '-i', videoFile,
        '-hide_banner'
      ]);
      
      let stderr = '';
      
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      ffmpeg.on('close', (code) => {
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
        console.error(`ffmpeg检测失败: ${error.message}`);
        resolve([]);
      });
    });
  }

  extractSubtitleStream(videoFile, streamIndex, outputFile, customFfmpegPath) {
    return new Promise((resolve, reject) => {
      const ffmpegPath = this.getFfmpegPath(customFfmpegPath);
      
      // 尝试不同的提取参数组合
      const extractAttempts = [
        [
          '-i', videoFile,
          '-map', `0:s:${streamIndex}`,
          '-c:s', 'webvtt',
          '-y',
          '-hide_banner',
          '-loglevel', 'error',
          outputFile
        ],
        // 备用参数组合，针对MP4格式
        [
          '-i', videoFile,
          '-map', `0:s:${streamIndex}`,
          '-c:s', 'webvtt',
          '-y',
          '-hide_banner',
          '-loglevel', 'error',
          '-fflags', '+genpts',
          outputFile
        ],
        // 另一个备用组合
        [
          '-i', videoFile,
          '-map', `0:s:${streamIndex}`,
          '-c:s', 'webvtt',
          '-y',
          '-hide_banner',
          '-loglevel', 'error',
          '-strict', 'experimental',
          outputFile
        ]
      ];
      
      const attemptExtraction = (attemptIndex) => {
        if (attemptIndex >= extractAttempts.length) {
          console.error(`所有提取尝试都失败了`);
          resolve(false);
          return;
        }
        
        const args = extractAttempts[attemptIndex];
        console.log(`尝试提取参数组合 ${attemptIndex + 1}: ${args.join(' ')}`);
        
        const ffmpeg = spawn(ffmpegPath, args);
        
        ffmpeg.on('close', (code) => {
          if (code === 0) {
            console.log(`提取成功，使用参数组合 ${attemptIndex + 1}`);
            resolve(true);
          } else {
            console.error(`提取失败，退出码: ${code}`);
            // 尝试下一个参数组合
            attemptExtraction(attemptIndex + 1);
          }
        });
        
        ffmpeg.on('error', (error) => {
          console.error(`提取字幕时出错: ${error.message}`);
          // 尝试下一个参数组合
          attemptExtraction(attemptIndex + 1);
        });
      };
      
      // 开始第一次尝试
      attemptExtraction(0);
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