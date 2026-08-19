export type AuthEmailLocale = 'zh' | 'en';

type VerifyEmailCopy = {
  subject: string;
  preview: string;
  heading: string;
  descriptionPrefix: string;
  descriptionSuffix: string;
  button: string;
  expires: string;
  linkHint: string;
  footer: string;
};

type ResetPasswordEmailCopy = {
  subject: string;
  text: string;
  html: string;
};

const normalizeAuthEmailLocale = (
  locale?: string | null
): AuthEmailLocale => (locale === 'zh' ? 'zh' : 'en');

export function resolveAuthEmailLocale(
  url: string,
  fallbackLocale: string | null = 'en'
): AuthEmailLocale {
  try {
    const pathname = new URL(url).pathname;
    if (pathname === '/zh' || pathname.startsWith('/zh/')) {
      return 'zh';
    }
    return 'en';
  } catch {
    // Fall through to the request-locale fallback.
  }

  return normalizeAuthEmailLocale(fallbackLocale);
}

export function getVerifyEmailCopy({
  locale,
  appName,
}: {
  locale?: string | null;
  appName: string;
}): VerifyEmailCopy {
  if (normalizeAuthEmailLocale(locale) === 'en') {
    return {
      subject: `Verify your email - ${appName}`,
      preview: `Verify your ${appName} account email`,
      heading: 'Verify your email',
      descriptionPrefix: 'Click the button below to verify your email and continue using ',
      descriptionSuffix: '.',
      button: 'Verify email',
      expires: 'This link expires in 24 hours.',
      linkHint: 'If the button does not open, copy this link into your browser:',
      footer: 'If you did not request this, you can safely ignore this email.',
    };
  }

  return {
    subject: `验证你的邮箱 - ${appName}`,
    preview: `请验证你的 ${appName} 账号邮箱`,
    heading: '请验证你的邮箱',
    descriptionPrefix: '点击下方按钮完成邮箱验证，即可继续使用',
    descriptionSuffix: '。',
    button: '验证邮箱',
    expires: '该链接将在 24 小时后失效。',
    linkHint: '如果按钮无法打开，请复制下面的链接到浏览器访问：',
    footer: '如果这不是你本人操作，可以直接忽略这封邮件。',
  };
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export function getResetPasswordEmailCopy({
  locale,
  appName,
  userName,
  url,
}: {
  locale?: string | null;
  appName: string;
  userName?: string | null;
  url: string;
}): ResetPasswordEmailCopy {
  if (normalizeAuthEmailLocale(locale) === 'en') {
    const greeting = userName ? `Hi ${userName},` : 'Hi,';
    const safeGreeting = escapeHtml(greeting);
    const safeAppName = escapeHtml(appName);
    const safeUrl = escapeHtml(url);

    return {
      subject: `Reset your ${appName} password`,
      text: `${greeting}\n\nYou requested a password reset for your ${appName} account. Use the link below to set a new password:\n\n${url}\n\nThis link expires in 1 hour. If you did not request this, you can safely ignore this email.`,
      html: `<p>${safeGreeting}</p>
<p>You requested a password reset for your <strong>${safeAppName}</strong> account. Click the link below to set a new password:</p>
<p><a href="${safeUrl}">Reset password</a></p>
<p>This link expires in 1 hour. If you did not request this, you can safely ignore this email.</p>`,
    };
  }

  const greeting = userName ? `你好，${userName}：` : '你好：';
  const safeGreeting = escapeHtml(greeting);
  const safeAppName = escapeHtml(appName);
  const safeUrl = escapeHtml(url);

  return {
    subject: `重置你的 ${appName} 密码`,
    text: `${greeting}\n\n你正在为 ${appName} 账号重置密码。请使用下面的链接设置新密码：\n\n${url}\n\n该链接将在 1 小时后失效。如果这不是你本人操作，可以直接忽略这封邮件。`,
    html: `<p>${safeGreeting}</p>
<p>你正在为 <strong>${safeAppName}</strong> 账号重置密码。点击下面的链接设置新密码：</p>
<p><a href="${safeUrl}">重置密码</a></p>
<p>该链接将在 1 小时后失效。如果这不是你本人操作，可以直接忽略这封邮件。</p>`,
  };
}
