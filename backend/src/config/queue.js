const { Queue } = require('bullmq');

const IORedis = require('ioredis');

// Parse REDIS_URL or fallback to localhost
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null, // Required by BullMQ
});

// Queue instance for sending emails
const emailQueue = new Queue('emailQueue', { 
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true, // Cleanup successful jobs
  }
});

const cleanupQueue = new Queue('cleanupQueue', { 
  connection,
  defaultJobOptions: {
    removeOnComplete: true,
  }
});

module.exports = {
  emailQueue,
  cleanupQueue,
  connection
};
