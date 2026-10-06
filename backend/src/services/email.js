import nodemailer from 'nodemailer'

let transporter

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })
  }
  return transporter
}

function safeDiagnostic(value) {
  return String(value ?? '')
    .replaceAll(process.env.EMAIL_PASS || '\u0000', '[redacted credential]')
    .replaceAll(process.env.EMAIL_USER || '\u0000', '[redacted email]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted email]')
    .slice(0, 1000)
}

export function emailIsConfigured() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.EMAIL_FROM)
}

export async function sendPasswordResetCode(to, code) {
  try {
    const result = await getTransporter().sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject: 'Your CareVault password reset code',
      text: `Your CareVault password reset code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
    })
    console.info('[password-reset] Gmail SMTP accepted the email.', {
      messageId: result.messageId || null,
    })
  } catch (error) {
    console.error('[password-reset] Gmail SMTP email delivery failed.', {
      code: error?.code,
      command: error?.command,
      responseCode: error?.responseCode,
      error: safeDiagnostic(error?.message || error),
    })
    throw new Error('Password reset email delivery failed.')
  }
}
