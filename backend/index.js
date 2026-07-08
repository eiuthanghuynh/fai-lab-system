require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const roleRoutes = require('./src/routes/roleRoutes');
const faiRoutes = require('./src/routes/faiRoutes');
const faiFailureModeRoutes = require('./src/routes/faiFailureModeRoutes');
const commodityPartRoutes = require('./src/routes/commodityPartRoutes');
const labRoutes = require('./src/routes/labRoutes');

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

// Middleware to authenticate socket connections could be added here
io.on('connection', (socket) => {
  // console.log(`Socket connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    // console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Expose io globally so controllers can emit events easily
global.io = io;

// Serve static files from uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Initialize cron jobs
const initCronJobs = require('./src/config/cron');
initCronJobs();

// Clear cached permissions on startup to ensure sync with database migrations/seed
const { delCache } = require('./src/utils/redisHelper');
delCache('permissions:all').catch(err => console.error('Failed to clear permissions cache on start:', err.message));

// Initialize Workers
const initEmailWorker = require('./src/workers/emailWorker');
initEmailWorker();

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
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/fai', faiRoutes);
app.use('/api/fai-failure-modes', faiFailureModeRoutes);
app.use('/api/commodity-parts', commodityPartRoutes);
app.use('/api/lab', labRoutes);

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