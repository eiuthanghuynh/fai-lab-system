const jwt = require('jsonwebtoken');

const prisma = require('../config/db');

const { getCache, setCache } = require('../utils/redisHelper');


const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required.' });

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check last_logout_at using Cache
    const cacheKey = `user:${user.id}:session`;
    let dbUser = await getCache(cacheKey);

    if (!dbUser) {
      dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (dbUser) {
        // Cache user info for 1 hour
        await setCache(cacheKey, dbUser, 3600);
      }
    }

    if (!dbUser || !dbUser.is_active) {
      return res.status(401).json({ error: 'User not found or inactive.' });
    }
    
    if (dbUser.last_logout_at) {
      const iatMs = user.iat * 1000;
      // Convert string date from Redis or Date object from Prisma
      const lastLogoutTime = new Date(dbUser.last_logout_at).getTime();
      // If token was issued before the last logout time, invalidate it
      if (iatMs < lastLogoutTime) {
        return res.status(401).json({ error: 'Token has been invalidated.' });
      }
    }

    req.user = {
      ...dbUser,
      permissions: user.permissions || []
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

const checkPermission = (permissionName) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }
    
    if (!req.user.permissions || !req.user.permissions.includes(permissionName)) {
      return res.status(403).json({ error: `Permission denied. Requires: ${permissionName}` });
    }
    next();
  };
};

const checkAnyPermission = (permissionNames) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }
    
    if (!req.user.permissions) {
      return res.status(403).json({ error: `Permission denied.` });
    }

    const hasAny = permissionNames.some(p => req.user.permissions.includes(p));
    if (!hasAny) {
      return res.status(403).json({ error: `Permission denied. Requires one of: ${permissionNames.join(', ')}` });
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  checkPermission,
  checkAnyPermission
};
