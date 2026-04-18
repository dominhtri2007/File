const nodemailer = require('nodemailer');

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function allowsDevEmailCode() {
  return String(process.env.ALLOW_DEV_EMAIL_CODE || '').toLowerCase() === 'true';
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendVerificationEmail(email, code) {
  if (!hasSmtpConfig()) {
    if (allowsDevEmailCode()) {
      console.log(`Email verification code for ${email}: ${code}`);
      return { sent: false, devCode: code };
    }

    const error = new Error('Chưa cấu hình SMTP nên không thể gửi mã xác thực qua email.');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }

  const appName = process.env.APP_NAME || 'Steam Manager';
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const transporter = createTransporter();

  await transporter.sendMail({
    from,
    to: email,
    subject: `${appName} - Mã xác thực đăng ký`,
    text: `Mã xác thực đăng ký của bạn là: ${code}. Mã có hiệu lực trong ${process.env.EMAIL_CODE_TTL_MINUTES || 10} phút.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>${appName}</h2>
        <p>Mã xác thực đăng ký của bạn là:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">${code}</p>
        <p>Mã có hiệu lực trong ${process.env.EMAIL_CODE_TTL_MINUTES || 10} phút.</p>
      </div>
    `,
  });

  return { sent: true };
}

async function sendPasswordResetEmail(email, code) {
  if (!hasSmtpConfig()) {
    if (allowsDevEmailCode()) {
      console.log(`Password reset code for ${email}: ${code}`);
      return { sent: false, devCode: code };
    }

    const error = new Error('Chưa cấu hình SMTP nên không thể gửi mã đặt lại mật khẩu qua email.');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }

  const appName = process.env.APP_NAME || 'Steam Manager';
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const transporter = createTransporter();

  await transporter.sendMail({
    from,
    to: email,
    subject: `${appName} - Mã đặt lại mật khẩu`,
    text: `Mã đặt lại mật khẩu của bạn là: ${code}. Mã có hiệu lực trong ${process.env.EMAIL_CODE_TTL_MINUTES || 10} phút.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>${appName}</h2>
        <p>Mã đặt lại mật khẩu của bạn là:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">${code}</p>
        <p>Mã có hiệu lực trong ${process.env.EMAIL_CODE_TTL_MINUTES || 10} phút.</p>
      </div>
    `,
  });

  return { sent: true };
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};
