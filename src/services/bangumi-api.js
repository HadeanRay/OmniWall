const https = require('https');

class BangumiAPI {
    constructor() {
        this.baseUrl = 'https://api.bgm.tv';
        this.userAgent = 'OmniWall/1.0 (https://github.com/yourusername/omniwall)';
        this.username = null;
    }

    /**
     * 设置Bangumi访问令牌
     * @param {string} token - Bangumi访问令牌
     */
    setToken(token) {
        this.token = token;
    }

    /**
     * 设置用户名
     * @param {string} username - Bangumi用户名
     */
    setUsername(username) {
        this.username = username;
    }

    /**
     * 发送HTTP请求
     * @param {string} path - API路径
     * @param {Object} options - 请求选项
     * @returns {Promise<Object>} 响应数据
     */
    async request(path, options = {}) {
        return new Promise((resolve, reject) => {
            const url = `${this.baseUrl}${path}`;
            console.log(`Bangumi API请求: ${url}`);
            
            const headers = {
                'User-Agent': this.userAgent,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                ...options.headers
            };

            // 如果有token，添加到请求头
            if (this.token) {
                headers['Authorization'] = `Bearer ${this.token}`;
            }

            const requestOptions = {
                method: options.method || 'GET',
                headers: headers,
                ...options
            };

            const req = https.request(url, requestOptions, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        // 检查响应是否为空
                        if (!data) {
                            reject(new Error(`HTTP ${res.statusCode}: 空响应`));
                            return;
                        }
                        
                        // 尝试解析JSON
                        let jsonData;
                        try {
                            jsonData = JSON.parse(data);
                        } catch (parseError) {
                            console.error('JSON解析失败，原始响应:', data);
                            reject(new Error(`HTTP ${res.statusCode}: 响应不是有效的JSON格式`));
                            return;
                        }
                        
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(jsonData);
                        } else {
                            const errorMessage = jsonData.title || jsonData.error || jsonData.message || data;
                            reject(new Error(`HTTP ${res.statusCode}: ${errorMessage}`));
                        }
                    } catch (error) {
                        reject(new Error(`处理响应失败: ${error.message}`));
                    }
                });
            });
            
            req.on('error', (error) => {
                reject(new Error(`网络请求失败: ${error.message}`));
            });
            
            // 如果有请求体数据，写入请求
            if (options.body) {
                req.write(JSON.stringify(options.body));
            }
            
            req.end();
        });
    }

    /**
     * 获取当前用户收藏（需要认证）
     * @param {Object} params - 查询参数
     * @returns {Promise<Object>} 收藏列表
     */
    async getMyCollection(params = {}) {
        if (!this.token) {
            throw new Error('需要认证令牌才能获取当前用户收藏');
        }
        
        // 首先获取用户信息以获取用户名
        if (!this.username) {
            try {
                const userInfo = await this.getUserInfo();
                this.username = userInfo.username;
            } catch (error) {
                throw new Error('无法获取用户信息: ' + error.message);
            }
        }
        
        const defaultParams = {
            subject_type: 2, // 2表示动画/电视剧
            limit: 30,
            offset: 0
        };
        
        // 使用新的API端点
        const finalParams = { ...defaultParams, ...params };
        const queryParams = new URLSearchParams(finalParams);
        
        return this.request(`/v0/users/${this.username}/collections?${queryParams.toString()}`);
    }

    /**
     * 获取条目详情
     * @param {number} subjectId - 条目ID
     * @returns {Promise<Object>} 条目详情
     */
    async getSubject(subjectId) {
        return this.request(`/v0/subjects/${subjectId}`);
    }

    /**
     * 获取用户信息
     * @returns {Promise<Object>} 用户信息
     */
    async getUserInfo() {
        if (!this.token) {
            throw new Error('需要认证令牌才能获取当前用户信息');
        }
        return this.request('/v0/me');
    }
}

module.exports = BangumiAPI;