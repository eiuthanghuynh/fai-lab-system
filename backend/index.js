require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET environment variable is missing.');
  process.exit(1);
}
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const roleRoutes = require('./src/routes/roleRoutes');
const faiRoutes = require('./src/routes/faiRoutes');
const faiFailureModeRoutes = require('./src/routes/faiFailureModeRoutes');
const commodityPartRoutes = require('./src/routes/commodityPartRoutes');
const supplierRoutes = require('./src/routes/supplierRoutes');
const itemTestRoutes = require('./src/routes/itemTestRoutes');
const labRoutes = require('./src/routes/labRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');

const paginationMiddleware = require('./src/middlewares/paginationMiddleware');

const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

const jwt = require('jsonwebtoken');
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication error: Token required'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    return next(new Error('Authentication error: Invalid token'));
  }
});

io.on('connection', (socket) => {
  socket.on('disconnect', () => {
  });
});

// Attach io to Express app for dependency injection
app.set('io', io);



// Cron jobs replaced by BullMQ (cleanupWorker.js)

// Clear cached permissions on startup to ensure sync with database migrations/seed
const { delCache } = require('./src/utils/redisHelper');


// Initialize Workers
const initEmailWorker = require('./src/workers/emailWorker');
initEmailWorker();

const initCleanupWorker = require('./src/workers/cleanupWorker');
initCleanupWorker();

const rateLimit = require('express-rate-limit');

// Rate Limiter: Max 200 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200,
  message: { error: 'Quá nhiều yêu cầu từ IP của bạn, vui lòng thử lại sau 1 phút.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(cors({
  origin: 'http://localhost:5173', // or your frontend url
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use('/api', apiLimiter); // Apply rate limiting to all /api routes

// Routes
app.use(paginationMiddleware);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/fai', faiRoutes);
app.use('/api/fai-failure-modes', faiFailureModeRoutes);
app.use('/api/commodity-parts', commodityPartRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/item-tests', itemTestRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Base route for health check
app.get('/', (req, res) => {
  res.json({ message: 'FAI/LAB Testing System API is running.' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server and Socket.io are running on port ${PORT}`);
});