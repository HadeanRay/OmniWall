// 测试新的 SubtitleExtractor 类
const { SubtitleExtractor } = require('./main.js');
const path = require('path');

async function testSubtitleExtractor() {
  console.log('测试 SubtitleExtractor 类...');
  
  // 测试获取字幕流信息
  try {
    const testVideo = '青春ブタ野郎はサンタクロースの夢を見ない - S01E01 - Puberty Continues.mkv';
    console.log('测试视频文件:', testVideo);
    
    if (require('fs').existsSync(testVideo)) {
      console.log('视频文件存在，开始测试字幕流信息获取...');
      
      const streams = await SubtitleExtractor.getSubtitleStreamsInfo(testVideo);
      console.log('字幕流信息:', streams);
      
      if (streams.length > 0) {
        console.log('找到字幕流，开始提取测试...');
        
        // 测试提取第一个字幕流
        const outputFile = 'test_subtitle.vtt';
        const success = await SubtitleExtractor.extractSubtitleStream(testVideo, 0, outputFile);
        
        if (success) {
          console.log('字幕提取成功，文件:', outputFile);
          
          // 检查文件是否存在
          if (require('fs').existsSync(outputFile)) {
            const stats = require('fs').statSync(outputFile);
            console.log('字幕文件大小:', stats.size, 'bytes');
          }
        } else {
          console.log('字幕提取失败');
        }
      } else {
        console.log('未找到字幕流，跳过提取测试');
      }
    } else {
      console.log('测试视频文件不存在，跳过实际测试');
      console.log('SubtitleExtractor 类导入成功，API 可用');
    }
  } catch (error) {
    console.error('测试失败:', error.message);
  }
}

testSubtitleExtractor();