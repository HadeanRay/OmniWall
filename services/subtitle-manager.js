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
      
      progressCallback({
        status: 'processing',
        current: processed + 1,
        total: videoFiles.length,
        currentFile: fileName
      });
      
      console.log(`处理视频文件: ${fileName}`);
      
      try {
        const subtitleStreams = await this.getSubtitleStreams(videoFile, customFfmpegPath);
        console.log(`视频 ${fileName} 包含 ${subtitleStreams.length} 个字幕流`);
        
        if (subtitleStreams.length > 0) {
          for (let i = 0; i < subtitleStreams.length; i++) {
            const outputFile = path.join(dirPath, `${baseName}.${i}.vtt`);
            
            if (fs.existsSync(outputFile)) {
              console.log(`字幕文件已存在: ${outputFile}`);
              continue;
            }
            
            const success = await this.extractSubtitleStream(videoFile, i, outputFile, customFfmpegPath);
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

  getSubtitleStreams(videoFile, customFfmpegPath) {
    return new Promise((resolve, reject) => {
      const ffmpegPath = this.getFfmpegPath(customFfmpegPath);
      
      const tryFfprobe = () => {
        return new Promise((resolveProbe) => {
          let probePath = ffmpegPath;
          
          if (ffmpegPath.endsWith('ffmpeg.exe') || ffmpegPath === 'ffmpeg') {
            probePath = ffmpegPath.replace('ffmpeg', 'ffprobe');
          }
          
          console.log(`尝试使用ffprobe路径: ${probePath}`);
          
          const ffprobe = spawn(probePath, [
            '-v', 'quiet',
            '-select_streams', 's',
            '-show_entries', 'stream=index',
            '-of', 'csv=p=0',
            videoFile
          ]);
          
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
              const subtitleStreams = stdout.trim().split('\n').map(line => {
                const index = parseInt(line.trim());
                return isNaN(index) ? null : index;
              }).filter(index => index !== null);
              
              console.log(`ffprobe找到字幕流: ${subtitleStreams.join(', ')}`);
              resolveProbe(subtitleStreams);
            } else {
              console.log('ffprobe未找到字幕流或失败');
              resolveProbe(null);
            }
          });
          
          ffprobe.on('error', (error) => {
            console.error(`ffprobe失败: ${error.message}`);
            resolveProbe(null);
          });
        });
      };
      
      tryFfprobe().then(probeResult => {
        if (probeResult !== null) {
          resolve(probeResult);
        } else {
          console.log('ffprobe失败，回退到使用ffmpeg检测...');
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
        const streamRegex = /Stream #(\d+):(\d+)(?:\([^)]+\))?: Subtitle:\s*([^\n]+)/g;
        let match;
        
        while ((match = streamRegex.exec(stderr)) !== null) {
          const streamIndex = parseInt(match[2]);
          subtitleStreams.push(streamIndex);
          console.log(`ffmpeg找到字幕流: ${streamIndex}, 详细信息: ${match[3]}`);
        }
        
        if (subtitleStreams.length === 0) {
          const simpleRegex = /Stream #\d+:(\d+)(?:\([^)]+\))?: Subtitle/g;
          let simpleMatch;
          
          while ((simpleMatch = simpleRegex.exec(stderr)) !== null) {
            const streamIndex = parseInt(simpleMatch[1]);
            subtitleStreams.push(streamIndex);
            console.log(`ffmpeg找到字幕流(简单匹配): ${streamIndex}`);
          }
        }
        
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
      
      const ffmpeg = spawn(ffmpegPath, [
        '-i', videoFile,
        '-map', `0:s:${streamIndex}`,
        '-c:s', 'webvtt',
        '-y',
        '-hide_banner',
        '-loglevel', 'error',
        outputFile
      ]);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          console.error(`提取字幕失败，退出码: ${code}`);
          resolve(false);
        }
      });
      
      ffmpeg.on('error', (error) => {
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