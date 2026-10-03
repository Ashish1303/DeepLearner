function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ] ?? character,
  );
}
export function passwordResetEmail(
  firstName: string,
  origin: string,
  token: string,
) {
  const link = new URL('/reset-password', origin);
  link.hash = `token=${encodeURIComponent(token)}`;
  return {
    subject: 'Reset your DeepLearner password',
    text: `Hello ${firstName},\n\nReset your password: ${link.href}\n\nThis link expires in 30 minutes. If you did not request this, ignore this email.`,
    html: `<p>Hello ${escapeHtml(firstName)},</p><p><a href="${escapeHtml(link.href)}">Reset your password</a></p><p>This link expires in 30 minutes. If you did not request this, ignore this email.</p>`,
  };
}
export function passwordResetConfirmation(firstName: string) {
  return {
    subject: 'Your DeepLearner password was reset',
    text: `Hello ${firstName},\n\nYour DeepLearner password was reset and existing sessions were revoked. If you did not do this, request password recovery immediately.`,
    html: `<p>Hello ${escapeHtml(firstName)},</p><p>Your DeepLearner password was reset and existing sessions were revoked. If you did not do this, request password recovery immediately.</p>`,
  };
}
