const fs = require('fs');
const path = require('path');
const os = require('os');

class ConfigManager {
  constructor() {
    this.configDir = path.join(os.homedir(), '.omniwall');
    this.settingsPath = path.join(this.configDir, 'settings.json');
    this.playbackProgressPath = path.join(this.configDir, 'playback-progress.json');
    this.lastPlayedPath = path.join(this.configDir, 'last-played.json');
    this.subtitleSettingsPath = path.join(this.configDir, 'subtitle-settings.json');
    
    this.ensureConfigDir();
  }

  ensureConfigDir() {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  loadSettings() {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('加载设置失败:', error);
    }
    return {};
  }

  saveSettings(settings) {
    try {
      fs.writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2));
      return true;
    } catch (error) {
      console.error('保存设置失败:', error);
      return false;
    }
  }

  loadPlaybackProgress() {
    return this.loadJsonFile(this.playbackProgressPath);
  }

  savePlaybackProgress(progressData) {
    try {
      const allProgress = this.loadPlaybackProgress();
      allProgress[progressData.videoPath] = progressData.progress;
      fs.writeFileSync(this.playbackProgressPath, JSON.stringify(allProgress, null, 2));
      console.log('播放进度已保存:', progressData.videoPath);
      return true;
    } catch (error) {
      console.error('保存播放进度失败:', error);
      return false;
    }
  }

  loadLastPlayed() {
    return this.loadJsonFile(this.lastPlayedPath);
  }

  saveLastPlayed(lastPlayedData) {
    try {
      const allRecords = this.loadLastPlayed();
      allRecords[lastPlayedData.tvShowPath] = {
        season: lastPlayedData.season,
        episode: lastPlayedData.episode,
        timestamp: lastPlayedData.timestamp
      };
      fs.writeFileSync(this.lastPlayedPath, JSON.stringify(allRecords, null, 2));
      console.log('最后播放记录已保存:', lastPlayedData.tvShowPath, '第', lastPlayedData.season, '季第', lastPlayedData.episode, '集');
      return true;
    } catch (error) {
      console.error('保存最后播放记录失败:', error);
      return false;
    }
  }

  loadSubtitleSettings() {
    return this.loadJsonFile(this.subtitleSettingsPath);
  }

  saveSubtitleSettings(subtitleSettingsData) {
    try {
      const allSettings = this.loadSubtitleSettings();
      const { tvShowPath, season, subtitleSetting } = subtitleSettingsData;
      
      if (!allSettings[tvShowPath]) {
        allSettings[tvShowPath] = {};
      }
      
      allSettings[tvShowPath][season] = subtitleSetting;
      fs.writeFileSync(this.subtitleSettingsPath, JSON.stringify(allSettings, null, 2));
      console.log('字幕设置已保存:', tvShowPath, '第', season, '季');
      return true;
    } catch (error) {
      console.error('保存字幕设置失败:', error);
      return false;
    }
  }

  loadJsonFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error(`加载文件失败 ${filePath}:`, error);
    }
    return {};
  }
}

module.exports = ConfigManager;