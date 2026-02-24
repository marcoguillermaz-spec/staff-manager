import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  try {
    await resend.emails.send({
      from: 'Staff Manager <noreply@testbusters.it>',
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error('[email] send failed to', to, err);
  }
}
