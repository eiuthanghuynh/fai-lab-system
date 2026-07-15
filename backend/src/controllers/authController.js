const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../config/db');
const { emailQueue } = require('../config/queue');
const { delCache } = require('../utils/redisHelper');

const register = async (req, res) => {
  {
    const { username, password, email, full_name, role_id } = req.body;

    // Validate inputs
    if (!username || !password || !email || !full_name || !role_id) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }]
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists.' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password_hash,
        full_name,
        role_id
      }
    });

    res.status(201).json({
      message: 'User registered successfully.',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        full_name: newUser.full_name
      }
    });
  }
};

const login = async (req, res) => {
  {
    const { username, password, keep_logged_in } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user || !user.is_active) {
      if (req.rateLimit) await req.rateLimit.increment();
      return res.status(401).json({ error: 'Invalid credentials or inactive user.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      if (req.rateLimit) await req.rateLimit.increment();
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Success login! Reset the rate limit counter.
    if (req.rateLimit) await req.rateLimit.reset();

    console.log(`[${new Date().toISOString()}] User [${user.username}] đã đăng nhập thành công`);

    const permissions = Array.from(new Set(
      user.roles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.name))
    ));
    const userRoles = user.roles.map(ur => ({
      id: ur.role.id,
      name: ur.role.name,
      badge_color: ur.role.badge_color
    }));

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        permissions
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const rememberToken = crypto.randomBytes(32).toString('hex');
    await prisma.user.update({
      where: { id: user.id },
      data: { remember_token: rememberToken }
    });

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    };

    if (keep_logged_in) {
      cookieOptions.maxAge = 24 * 60 * 60 * 1000; // 1 day
    }

    res.cookie('remember_token', rememberToken, cookieOptions);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        department: user.department,
        roles: userRoles,
        permissions
      }
    });
  }
};

const me = async (req, res) => {
  {
    const rememberToken = req.cookies?.remember_token;
    if (!rememberToken) {
      return res.status(401).json({ error: 'No remember token provided.' });
    }

    const user = await prisma.user.findFirst({
      where: { remember_token: rememberToken, is_active: true },
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

    if (!user) {
      res.clearCookie('remember_token');
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }

    const permissions = Array.from(new Set(
      user.roles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.name))
    ));
    const userRoles = user.roles.map(ur => ({
      id: ur.role.id,
      name: ur.role.name,
      badge_color: ur.role.badge_color
    }));

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        permissions
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({
      message: 'Auto-login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        department: user.department,
        roles: userRoles,
        permissions
      }
    });
  }
};

const logout = async (req, res) => {
  {
    res.clearCookie('remember_token');
    const userId = req.user?.id;
    const rememberToken = req.cookies?.remember_token;

    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: { remember_token: null, last_logout_at: new Date() }
      });
      await delCache(`user:${userId}:session`);
    } else if (rememberToken) {
      await prisma.user.updateMany({
        where: { remember_token: rememberToken },
        data: { remember_token: null }
      });
    }

    res.json({ message: 'Logged out successfully.' });
  }
};

const forgotPassword = async (req, res) => {
  {
    const { email, employee_id } = req.body;

    // Phản hồi "Security-first": Luôn báo thành công nếu format không sai
    if (!email || !employee_id) {
      return res.status(400).json({ error: 'Email and Employee ID are required.' });
    }

    const user = await prisma.user.findFirst({
      where: { email, employee_id, is_active: true }
    });

    if (user) {
      // 1. Tạo token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

      // 2. Lưu token vào DB, hạn 5 phút
      await prisma.user.update({
        where: { id: user.id },
        data: {
          reset_password_token: hashedToken,
          reset_password_expires: new Date(Date.now() + 5 * 60 * 1000)
        }
      });

      // 3. Đẩy việc gửi email vào Queue
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const resetLink = `${frontendUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;

      await emailQueue.add('sendResetPassword', { email, resetLink });
    }

    // Luôn trả về 200 để chống dò quét email
    res.json({ message: 'If the information is correct, an email has been sent.' });
  }
};

const resetPassword = async (req, res) => {
  {
    const { email, token, new_password } = req.body;

    if (!email || !token || !new_password) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        email,
        reset_password_token: hashedToken,
        reset_password_expires: { gt: new Date() }, // Chưa hết hạn
        is_active: true
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Token không hợp lệ hoặc đã hết hạn.' });
    }

    // Mã hóa mật khẩu mới
    const password_hash = await bcrypt.hash(new_password, 10);

    // Cập nhật DB và xóa token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash,
        reset_password_token: null,
        reset_password_expires: null,
        // (Optional) Xóa luôn remember_token để bắt buộc đăng nhập lại trên mọi thiết bị
        remember_token: null
      }
    });

    res.json({ message: 'Mật khẩu đã được thiết lập lại thành công.' });
  }
};

const verifyResetToken = async (req, res) => {
  {
    const { email, token } = req.query;

    if (!email || !token) {
      return res.status(400).json({ error: 'Missing required parameters.' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        email,
        reset_password_token: hashedToken,
        reset_password_expires: { gt: new Date() },
        is_active: true
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Token không hợp lệ hoặc đã hết hạn.' });
    }

    res.json({ valid: true });
  }
};

const getCurrentPermissions = async (req, res) => {
  {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }
    const permissions = req.user?.permissions || [];
    res.json({ permissions });
  }
};

module.exports = {
  register,
  login,
  me,
  logout,
  forgotPassword,
  resetPassword,
  verifyResetToken,
  getCurrentPermissions
};
