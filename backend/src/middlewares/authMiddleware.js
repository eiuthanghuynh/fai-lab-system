const jwt = require('jsonwebtoken');

const prisma = require('../config/db');

const { getCache, setCache } = require('../utils/redisHelper');

const getUserPermissions = async (userId) => {
  const cacheKey = `user:${userId}:permissions`;
  let permissions = await getCache(cacheKey);

  if (!permissions) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true }
                }
              }
            }
          }
        }
      }
    });

    if (user) {
      permissions = Array.from(new Set(
        user.roles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.name))
      ));
      await setCache(cacheKey, permissions, 3600); // Cache for 1 hour
    } else {
      permissions = [];
    }
  }
  return permissions;
};

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required.' });

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    
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

    // Fetch real-time permissions and attach them to request user object
    const permissions = await getUserPermissions(user.id);
    req.user = {
      ...dbUser,
      permissions
    };
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
};

const checkPermission = (permissionName) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }
    
    const permissions = await getUserPermissions(req.user.id);
    if (!permissions || !permissions.includes(permissionName)) {
      return res.status(403).json({ error: `Permission denied. Requires: ${permissionName}` });
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  checkPermission,
  getUserPermissions
};
