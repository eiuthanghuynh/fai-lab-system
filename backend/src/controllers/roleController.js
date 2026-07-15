const prisma = require('../config/db');
const { getCache, setCache, delCache, clearAllUserPermissionsCache } = require('../utils/redisHelper');

const getRoles = async (req, res) => {
  {
    const { 
      page = 1, 
      limit = 25, 
      search,
      is_active,
      permission_ids,
      sort_by = 'id',
      sort_desc = 'false'
    } = req.query;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (is_active !== undefined && is_active !== '') {
      where.is_active = is_active === 'true';
    }

    let pIds = [];
    if (permission_ids) {
      pIds = permission_ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
      if (pIds.length > 0) {
        where.permissions = {
          some: {
            permission_id: { in: pIds }
          }
        };
      }
    }

    const orderBy = {};
    const isDesc = sort_desc === 'true';
    const direction = isDesc ? 'desc' : 'asc';

    if (sort_by === 'permissions') {
       orderBy.id = direction; 
    } else if (sort_by === 'status') {
       orderBy.is_active = direction;
    } else {
       orderBy[sort_by] = direction;
    }

    let roles = await prisma.role.findMany({
      where,
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      },
      orderBy,
    });

    if (pIds.length > 1) {
      roles.forEach(r => {
        r._matchCount = r.permissions.filter(rp => pIds.includes(rp.permission_id)).length;
      });
      roles.sort((a, b) => b._matchCount - a._matchCount);
    }

    const total = roles.length;
    roles = roles.slice(skip, skip + limitNumber);

    res.json({
      data: roles,
      total,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(total / limitNumber)
    });
  }
};

const createRole = async (req, res) => {
  {
    const { name, description, badge_color, permission_ids } = req.body;

    if (!name) return res.status(400).json({ error: 'Role name is required.' });

    const newRole = await prisma.role.create({
      data: {
        name,
        description,
        badge_color: badge_color || '#63e079',
        permissions: {
          create: permission_ids ? permission_ids.map(id => ({ permission_id: id })) : []
        }
      },
      include: {
        permissions: { include: { permission: true } }
      }
    });

    if (global.io) {
      global.io.emit('role-created', newRole);
    }

    res.status(201).json(newRole);
  }
};

const updateRole = async (req, res) => {
  {
    const { id } = req.params;
    const { name, description, badge_color, permission_ids } = req.body;

    // Remove existing permissions if permission_ids is provided
    if (permission_ids !== undefined) {
      await prisma.rolePermission.deleteMany({
        where: { role_id: parseInt(id) }
      });
    }

    const updatedRole = await prisma.role.update({
      where: { id: parseInt(id) },
      data: {
        name,
        description,
        badge_color,
        ...(permission_ids !== undefined && {
          permissions: {
            create: permission_ids.map(permId => ({ permission_id: permId }))
          }
        })
      },
      include: {
        permissions: { include: { permission: true } }
      }
    });

    // Invalidate affected users (excluding the user making the change)
    const affectedUsers = await prisma.user.findMany({
      where: { 
        roles: { some: { role_id: parseInt(id) } },
        id: { not: req.user.id }
      },
      select: { id: true }
    });
    if (affectedUsers.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: affectedUsers.map(u => u.id) } },
        data: { last_logout_at: new Date() }
      });
      const { delCache } = require('../utils/redisHelper');
      for (const u of affectedUsers) {
        await delCache(`user:${u.id}:session`);
        await delCache(`user:${u.id}:permissions`);
      }
    }
    await delCache(`user:${req.user.id}:permissions`);

    if (global.io) {
      global.io.emit('role-updated', updatedRole);
    }

    res.json(updatedRole);
  }
};

const deleteRole = async (req, res) => {
  {
    const { id } = req.params;
    const deletedRole = await prisma.role.update({
      where: { id: parseInt(id) },
      data: { is_active: false }
    });

    // Invalidate affected users
    const affectedUsers = await prisma.user.findMany({
      where: { 
        roles: { some: { role_id: parseInt(id) } },
        id: { not: req.user.id }
      },
      select: { id: true }
    });
    if (affectedUsers.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: affectedUsers.map(u => u.id) } },
        data: { last_logout_at: new Date() }
      });
      const { delCache } = require('../utils/redisHelper');
      for (const u of affectedUsers) {
        await delCache(`user:${u.id}:session`);
        await delCache(`user:${u.id}:permissions`);
      }
    }
    await delCache(`user:${req.user.id}:permissions`);

    if (global.io) {
      global.io.emit('role-deleted', parseInt(id));
    }

    res.json(deletedRole);
  }
};

const restoreRole = async (req, res) => {
  {
    const { id } = req.params;
    const restoredRole = await prisma.role.update({
      where: { id: parseInt(id) },
      data: { is_active: true }
    });
    await clearAllUserPermissionsCache();
    if (global.io) {
      global.io.emit('role-restored', restoredRole);
    }
    res.json(restoredRole);
  }
};

// Also need a way to get all permissions to show in the checkbox table
const getPermissions = async (req, res) => {
  {
    const cacheKey = 'permissions:all';
    let permissions = await getCache(cacheKey);

    if (!permissions) {
      permissions = await prisma.permission.findMany({
        orderBy: { id: 'asc' }
      });
      await setCache(cacheKey, permissions, 86400); // cache 24h
    }

    res.json(permissions);
  }
};

module.exports = {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  restoreRole,
  getPermissions
};
