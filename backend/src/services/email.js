const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export function emailIsConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
}

export async function sendPasswordResetCode(to, code) {
  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [to],
      subject: 'Your CareVault password reset code',
      text: `Your CareVault password reset code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
    }),
  })
  if (!response.ok) throw new Error('Password reset email delivery failed.')
}
