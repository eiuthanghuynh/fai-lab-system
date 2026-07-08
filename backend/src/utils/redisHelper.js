const { connection: redis } = require('../config/queue');

/**
 * Lấy dữ liệu từ Redis an toàn (Fallback cơ bản)
 * @param {string} key 
 * @returns {any} object parse từ JSON hoặc null
 */
const getCache = async (key) => {
  try {
    const data = await redis.get(key);
    if (data) {
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.warn(`[Redis Helper] Get Cache Error for key ${key}:`, error.message);
    return null; // Fallback: Giả vờ như không có cache
  }
};

/**
 * Lưu dữ liệu vào Redis an toàn
 * @param {string} key 
 * @param {any} value 
 * @param {number} ttl Thời gian sống (giây)
 */
const setCache = async (key, value, ttl = 3600) => {
  try {
    const stringValue = JSON.stringify(value);
    await redis.set(key, stringValue, 'EX', ttl);
  } catch (error) {
    console.warn(`[Redis Helper] Set Cache Error for key ${key}:`, error.message);
  }
};

/**
 * Xóa dữ liệu khỏi Redis an toàn
 * @param {string} key 
 */
const delCache = async (key) => {
  try {
    await redis.del(key);
  } catch (error) {
    console.warn(`[Redis Helper] Delete Cache Error for key ${key}:`, error.message);
  }
};

const clearAllUserPermissionsCache = async () => {
  try {
    const keys = await redis.keys('user:*:permissions');
    if (keys && keys.length > 0) {
      await redis.del(keys);
      console.log(`[Redis Helper] Cleared user permission caches: ${keys.length} keys`);
    }
  } catch (error) {
    console.warn('[Redis Helper] Clear User Permissions Cache Error:', error.message);
  }
};

module.exports = {
  getCache,
  setCache,
  delCache,
  clearAllUserPermissionsCache
};
