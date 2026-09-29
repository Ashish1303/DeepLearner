function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ] ?? character,
  );
}
export function verificationEmail(
  firstName: string,
  origin: string,
  token: string,
) {
  const link = new URL('/verify-email', origin);
  link.hash = `token=${encodeURIComponent(token)}`;
  const text = `Hello ${firstName},\n\nVerify your DeepLearner email: ${link.href}\n\nThis link expires in 15 minutes. If you did not request this, ignore this email.`;
  return {
    subject: 'Verify your DeepLearner email',
    text,
    html: `<p>Hello ${escapeHtml(firstName)},</p><p><a href="${escapeHtml(link.href)}">Verify your DeepLearner email</a></p><p>This link expires in 15 minutes. If you did not request this, ignore this email.</p>`,
  };
}
