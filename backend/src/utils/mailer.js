const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendResetPasswordEmail = async (toEmail, resetLink) => {
  try {
    // Render HTML from EJS template
    const templatePath = path.join(__dirname, '../templates/emails/resetPassword.ejs');
    const html = await ejs.renderFile(templatePath, { resetLink });

    const mailOptions = {
      from: `"FAI/LAB System" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject: 'Yêu cầu khôi phục mật khẩu - FAI/LAB System',
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${toEmail}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Lỗi khi gửi email:', error);
    throw error;
  }
};

module.exports = {
  sendResetPasswordEmail,
};
