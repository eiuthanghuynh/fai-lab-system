const cron = require('node-cron');
const prisma = require('./db');

const initCronJobs = () => {
  // Run daily at 17:00 Vietnam time (GMT+7)
  cron.schedule('0 17 * * *', async () => {
    try {
      console.log('Running daily global logout task at 17:00 VN Time...');
      await prisma.user.updateMany({
        data: {
          last_logout_at: new Date(),
          remember_token: null
        }
      });
      console.log('Successfully updated last_logout_at for all users.');
    } catch (err) {
      console.error('Error running daily global logout task:', err);
    }
  }, {
    timezone: 'Asia/Ho_Chi_Minh'
  });
};

module.exports = initCronJobs;
