const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // App Password if using Gmail
  },
});

const sendResetPasswordEmail = async (toEmail, resetLink) => {
  try {
    const mailOptions = {
      from: `"FAI/LAB System" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject: 'Yêu cầu khôi phục mật khẩu - FAI/LAB System',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #002465; padding: 20px; text-align: center;">
            <h2 style="color: #fff; margin: 0;">Khôi phục mật khẩu</h2>
          </div>
          <div style="padding: 20px;">
            <p>Chào bạn,</p>
            <p>Chúng tôi nhận được yêu cầu khôi phục mật khẩu cho tài khoản liên kết với địa chỉ email này trên hệ thống FAI/LAB.</p>
            <p>Vui lòng click vào nút bên dưới để tiến hành đặt lại mật khẩu của bạn. Link này chỉ có hiệu lực trong vòng <strong>5 phút</strong> và chỉ sử dụng được <strong>1 lần</strong>.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #3b8949; color: #fff; text-decoration: none; padding: 12px 25px; border-radius: 5px; font-weight: bold; display: inline-block;">Đặt lại mật khẩu</a>
            </div>
            <p>Nếu bạn không yêu cầu khôi phục mật khẩu, vui lòng bỏ qua email này.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #777;">Email này được gửi tự động từ hệ thống, vui lòng không trả lời.</p>
          </div>
        </div>
      `,
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
