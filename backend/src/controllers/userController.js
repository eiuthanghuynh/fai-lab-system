const bcrypt = require('bcrypt');
const prisma = require('../config/db');
const { delCache } = require('../utils/redisHelper');
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const handlePrismaError = (error, res) => {
  if (error.code === 'P2002') {
    const targetStr = (error.meta && error.meta.target) 
      ? (Array.isArray(error.meta.target) ? error.meta.target.join(',') : error.meta.target)
      : error.message;
      
    if (targetStr.includes('username')) return res.status(409).json({ error: 'username_exists' });
    if (targetStr.includes('email')) return res.status(409).json({ error: 'email_exists' });
    if (targetStr.includes('employee_id')) return res.status(409).json({ error: 'employee_id_exists' });
    return res.status(409).json({ error: 'save_failed' });
  }
  return res.status(500).json({ error: 'Internal server error.' });
};

const getUsers = async (req, res) => {
  {
    const { 
      page = 1, 
      limit = 25, 
      search, 
      role_ids, 
      is_active, 
      start_date, 
      end_date, 
      date_type = 'created_at',
      sort_by = 'id',
      sort_desc = 'false'
    } = req.query;

    const { limitNumber, skip } = req.pagination;

    // Build where clause
    const where = {};

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { full_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employee_id: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } }
      ];
    }

    let parsedRoleIds = [];
    if (role_ids) {
      parsedRoleIds = role_ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
      if (parsedRoleIds.length > 0) {
        where.roles = {
          some: {
            role_id: { in: parsedRoleIds }
          }
        };
      }
    }

    if (is_active !== undefined && is_active !== '') {
      where.is_active = is_active === 'true';
    }

    if (start_date || end_date) {
      const dateField = date_type === 'updated_at' ? 'updated_at' : 'created_at';
      where[dateField] = {};
      if (start_date) where[dateField].gte = new Date(start_date);
      if (end_date) {
        // Adjust end date to include the whole day
        const end = new Date(end_date);
        end.setHours(23, 59, 59, 999);
        where[dateField].lte = end;
      }
    }

    const orderBy = {};
    const isDesc = sort_desc === 'true';
    const direction = isDesc ? 'desc' : 'asc';

    if (sort_by === 'role') {
      orderBy.id = direction;
    } else if (sort_by === 'status') {
      orderBy.is_active = direction;
    } else {
      orderBy[sort_by] = direction;
    }

    let users = await prisma.user.findMany({
      where,
      include: { 
        roles: {
          include: { role: true }
        }
      },
      orderBy,
    });

    if (parsedRoleIds.length > 1) {
      // Advanced requirement: Sort by highest matching roles first
      users.forEach(u => {
        u._matchCount = u.roles.filter(ur => parsedRoleIds.includes(ur.role_id)).length;
      });
      users.sort((a, b) => b._matchCount - a._matchCount);
    }

    const total = users.length;

    // Pagination in memory
    users = users.slice(skip, skip + limitNumber);

    // Omit password hash for safety
    const safeUsers = users.map(user => {
      const { password_hash, _matchCount, roles, ...safeUser } = user;
      return {
        ...safeUser,
        roles: roles ? roles.map(r => r.role) : []
      };
    });

    return res.paginate(safeUsers, total);
  }
};

const createUser = async (req, res) => {
  try {
    const { username, password, email, full_name, department, role_ids, employee_id } = req.body;

    if (!username || !password || !email || !full_name || !role_ids || !Array.isArray(role_ids) || role_ids.length === 0 || !employee_id) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    if (!passwordRegex.test(password)) {
      return res.status(400).json({ error: 'password_format' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password_hash,
        full_name,
        department,
        employee_id,
        roles: {
          create: role_ids.map(id => ({ role_id: parseInt(id) }))
        }
      },
      include: { roles: { include: { role: true } } }
    });

    const { password_hash: _hash, ...safeUser } = newUser;
    if (req.app.get('io')) {
      req.app.get('io').emit('user-created', safeUser);
    }
    res.status(201).json(safeUser);
  } catch (error) {
    console.error('createUser error:', error);
    return handlePrismaError(error, res);
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, full_name, department, role_ids, password, employee_id } = req.body;

    const updateData = {
      username,
      email,
      full_name,
      department,
      employee_id,
    };

    if (password) {
      if (!passwordRegex.test(password)) {
        return res.status(400).json({ error: 'password_format' });
      }
      updateData.password_hash = await bcrypt.hash(password, 10);
    }

    // Clean undefined fields
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    if (role_ids && Array.isArray(role_ids)) {
      if (role_ids.length === 0) {
        return res.status(400).json({ error: 'role_required' });
      }
      
      updateData.roles = {
        deleteMany: {}, // Xóa các role cũ
        create: role_ids.map(rid => ({ role_id: parseInt(rid) }))
      };
      
      // Invalidate cache immediately for this user when role changes, UNLESS it's the admin editing themselves
      if (parseInt(id) !== req.user.id) {
        updateData.last_logout_at = new Date();
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: { roles: { include: { role: true } } }
    });

    if (updateData.last_logout_at) {
      await delCache(`user:${id}:session`);
    }


    const { password_hash: _hash, ...safeUser } = updatedUser;
    if (req.app.get('io')) {
      req.app.get('io').emit('user-updated', safeUser);
    }
    res.json(safeUser);
  } catch (error) {
    console.error('updateUser error:', error);
    return handlePrismaError(error, res);
  }
};

const deleteUser = async (req, res) => {
  {
    const { id } = req.params;
    const deletedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { 
        is_active: false,
        last_logout_at: new Date() // Invalidate their current session immediately
      }
    });
    await delCache(`user:${id}:session`);

    if (req.app.get('io')) {
      req.app.get('io').emit('user-deleted', parseInt(id));
    }
    res.json({ message: 'User soft deleted and sessions invalidated.', id: deletedUser.id });
  }
};

const restoreUser = async (req, res) => {
  {
    const { id } = req.params;
    const restoredUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { is_active: true }
    });

    if (req.app.get('io')) {
      req.app.get('io').emit('user-restored', restoredUser);
    }
    res.json({ message: 'User restored.', id: restoredUser.id });
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  restoreUser
};
