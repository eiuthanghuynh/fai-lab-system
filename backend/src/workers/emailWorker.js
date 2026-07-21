const { Worker } = require('bullmq');
const { connection } = require('../config/queue');
const { sendResetPasswordEmail } = require('../utils/mailer');

const initEmailWorker = () => {
  const worker = new Worker(
    'emailQueue',
    async (job) => {
      if (job.name === 'sendResetPassword') {
        const { email, resetLink } = job.data;
        console.log(`[Worker] Processing sendResetPassword for ${email}...`);
        await sendResetPasswordEmail(email, resetLink);
        console.log(`[Worker] Completed sendResetPassword for ${email}`);
      } else if (job.name === 'sendLabApprovalResult') {
        const { requestId, testNo, requestorId, result } = job.data;
        console.log(`[Worker] Placeholder: Processing sendLabApprovalResult for Request ID: ${requestId} (${testNo}). Result: ${result}. Requestor ID: ${requestorId}...`);
        // TODO: Implement actual email sending with template/mailer helper in future
        console.log(`[Worker] Placeholder: Completed sendLabApprovalResult for Request ID: ${requestId}`);
      }
    },
    {
      connection,
      limiter: {
        max: 10, // Max 10 emails
        duration: 1000, // per second
      },
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job.id} failed:`, err.message);
  });

  return worker;
};

module.exports = initEmailWorker;
