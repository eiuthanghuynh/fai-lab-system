const { connection: redis } = require('../config/queue');

/**
 * Middleware Rate Limiting sử dụng Redis
 * @param {string} prefix Tiền tố cho cache key
 * @param {number} limit Số lượng request tối đa
 * @param {number} windowMs Cửa sổ thời gian tính bằng milliseconds
 */
const rateLimiter = (prefix, limit, windowMs, options = {}) => {
  const incrementOnRequest = options.incrementOnRequest !== false;

  return async (req, res, next) => {
    try {
      // Dùng IP hoặc Email/Username làm định danh (thường kết hợp cả 2)
      const identifier = (req.body && (req.body.email || req.body.username)) || req.ip || 'unknown';
      const key = `ratelimit:${prefix}:${identifier}`;

      const currentCount = await redis.get(key);

      if (currentCount && parseInt(currentCount) >= limit) {
        if (prefix === 'login') {
          console.log(`[${new Date().toISOString()}] User [${identifier}] đã bị chặn đăng nhập trong 2 phút`);
        }
        return res.status(429).json({ 
          error: 'Too many requests, please try again later.' 
        });
      }

      if (incrementOnRequest) {
        const newCount = await redis.incr(key);
        if (newCount === 1) {
          await redis.pexpire(key, windowMs);
        } else {
          const ttl = await redis.pttl(key);
          if (ttl === -1) await redis.pexpire(key, windowMs);
        }
      }

      // Attach helper for controllers to manually increment or reset
      req.rateLimit = {
        key,
        increment: async () => {
          const newCount = await redis.incr(key);
          if (newCount === 1) {
            await redis.pexpire(key, windowMs);
          } else {
            const ttl = await redis.pttl(key);
            if (ttl === -1) await redis.pexpire(key, windowMs);
          }
        },
        reset: async () => {
          await redis.del(key);
        }
      };

      next();
    } catch (error) {
      console.warn('[RateLimiter] Error, bypassing rate limit:', error.message);
      require('fs').appendFileSync('rateLimitError.log', error.stack + '\n');
      // Fallback: Cho phép request đi qua nếu Redis lỗi để đảm bảo Zero Downtime
      next();
    }
  };
};

module.exports = rateLimiter;
