const { spawn } = require('child_process');
const path = require('path');

// 测试单个视频文件的字幕流检测
async function testSubtitleDetection(videoFile, customFfmpegPath = null) {
  console.log(`测试视频文件: ${videoFile}`);
  
  function getFfmpegPath(customFfmpegPath) {
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
  
  // 方法1: 使用ffprobe检测
  function probeSubtitleStreams(videoFile, ffmpegPath) {
    return new Promise((resolve) => {
      let probePath = ffmpegPath;
      
      if (ffmpegPath.endsWith('ffmpeg.exe') || ffmpegPath === 'ffmpeg') {
        probePath = ffmpegPath.replace('ffmpeg', 'ffprobe');
      }
      
      console.log(`使用ffprobe路径: ${probePath}`);
      
      const ffprobe = spawn(probePath, [
        '-v', 'quiet',
        '-select_streams', 's',
        '-show_entries', 'stream=index,codec_name',
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
        console.log(`ffprobe退出码: ${code}`);
        console.log(`ffprobe输出: ${stdout}`);
        
        if (code === 0 && stdout.trim()) {
          const streams = stdout.trim().split('\n').map(line => {
            const parts = line.split(',');
            return { index: parseInt(parts[0]), codec: parts[1] };
          });
          resolve(streams);
        } else {
          console.log('ffprobe未找到字幕流');
          resolve([]);
        }
      });
      
      ffprobe.on('error', (error) => {
        console.error(`ffprobe错误: ${error.message}`);
        resolve([]);
      });
    });
  }
  
  const ffmpegPath = getFfmpegPath(customFfmpegPath);
  console.log(`最终使用的ffmpeg路径: ${ffmpegPath}`);
  
  // 测试ffprobe
  const streams = await probeSubtitleStreams(videoFile, ffmpegPath);
  console.log(`检测到的字幕流:`, streams);
  
  return streams;
}

// 测试指定的视频文件
const testVideo = '青春ブタ野郎はサンタクロースの夢を見ない - S01E01 - Puberty Continues.mkv';

// 如果提供了自定义ffmpeg路径
const customFfmpegPath = process.argv[2];

testSubtitleDetection(testVideo, customFfmpegPath)
  .then(streams => {
    console.log('测试完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('测试失败:', error);
    process.exit(1);
  });