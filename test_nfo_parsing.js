// 测试nfo文件解析功能的脚本

// 从文件名中提取集号
function extractEpisodeNumberFromName(filename) {
  const name = filename.toLowerCase();
  
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
      const episodeNumber = parseInt(match[1]);
      console.log(`文件 "${filename}" 匹配模式 ${pattern}，提取集号: ${episodeNumber}`);
      return episodeNumber;
    }
  }
  
  // 如果还是没找到，尝试更宽松的匹配 - 查找文件名中的第一个数字序列
  const numberMatch = name.match(/(\d{1,3})/);
  if (numberMatch) {
    const episodeNumber = parseInt(numberMatch[1]);
    console.log(`文件 "${filename}" 使用宽松匹配，提取集号: ${episodeNumber}`);
    return episodeNumber;
  }
  
  console.log(`文件 "${filename}" 无法提取集号`);
  return null;
}

// 测试nfo文件识别
console.log("=== 测试nfo文件集号提取 ===");
const nfoFiles = [
  { name: "[TOC] 轉生成自動販賣機的我今天也在迷宮徘徊 第二季 [01][1080P][AVC AAC][CHT][MP4].nfo", expectedEpisode: 1 },
  { name: "[TOC] 新吊帶襪天使 [01][1080P][AVC AAC][CHT][MP4].nfo", expectedEpisode: 1 },
  { name: "[CheeseAni] Seishun Buta Yarou wa Santa Claus no Yume wo Minai [01][CR-WebRip 1080p HEVC AAC SRT][简繁内封].nfo", expectedEpisode: 1 },
  { name: "[LoliHouse] Yofukashi no Uta S2 - 01v1 [WebRip 1080p HEVC-10bit AAC SRTx2].nfo", expectedEpisode: 1 },
  { name: "[Prejudice-Studio] 神椿市建设中。 Kamitsubaki-shi Kensetsuchuu - 01 [Bilibili WEB-DL 1080P AVC 8bit AAC MP4][ 简日内嵌].nfo", expectedEpisode: 1 }
];

nfoFiles.forEach(nfoFile => {
  const episodeNumber = extractEpisodeNumberFromName(nfoFile.name);
  const success = episodeNumber === nfoFile.expectedEpisode;
  console.log(`测试 ${nfoFile.name}: 期望=${nfoFile.expectedEpisode}, 实际=${episodeNumber}, ${success ? '✓ 通过' : '✗ 失败'}`);
});

console.log("\n测试完成");