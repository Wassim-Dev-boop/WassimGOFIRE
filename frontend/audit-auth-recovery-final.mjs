import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const API_BASE = 'http://localhost:8088';
const UI_BASE = 'http://localhost:4200';
const MAILHOG_BASE = 'http://localhost:8025';
const ADMIN = { identifier: 'admin.cnstn', password: 'Admin@12345' };

const report = { timestamp: new Date().toISOString(), dataset: {}, checks: {} };

async function login(identifier, password) {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  return { status: response.status, ok: response.ok, data };
}

async function api(token, method, path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  return { status: response.status, ok: response.ok, data };
}

async function mailhogMessages() {
  const response = await fetch(`${MAILHOG_BASE}/api/v2/messages`);
  if (!response.ok) {
    return { total: -1, items: [] };
  }
  const data = await response.json();
  return { total: data.total ?? data.count ?? 0, items: data.items ?? [] };
}

function extractBody(message) {
  const parts = message?.MIME?.Parts;
  if (Array.isArray(parts) && parts.length > 0) {
    return parts.map((part) => part?.Body ?? '').join('\n');
  }
  return message?.Content?.Body ?? '';
}

function extractResetToken(messages, email) {
  const target = messages.find((message) => {
    const recipients = JSON.stringify(message?.Content?.Headers?.To ?? message?.To ?? '');
    const body = extractBody(message);
    return recipients.toLowerCase().includes(email.toLowerCase()) || body.toLowerCase().includes(email.toLowerCase());
  });
  const body = extractBody(target);
  const match = /reset-password\?token=([A-Za-z0-9_-]+)/.exec(body);
  return match?.[1] ?? null;
}

(async () => {
  const suffix = Date.now();
  const pendingEmail = `audit.pending.${suffix}@cnstn.tn`;
  const activeEmail = `audit.reset.${suffix}@cnstn.tn`;
  const initialPassword = 'Init@12345';
  const resetPassword = 'Reset@12345';

  const adminLogin = await login(ADMIN.identifier, ADMIN.password);
  if (!adminLogin.ok) {
    throw new Error(`admin login KO ${adminLogin.status}`);
  }
  const adminToken = adminLogin.data.access_token;

  const signup = await api(null, 'POST', '/api/v1/auth/signup', {
    firstName: 'Audit',
    lastName: 'Pending',
    email: pendingEmail,
    phone: '+21620000901',
    departmentId: null,
    password: initialPassword,
    confirmPassword: initialPassword,
  });

  const pendingAdminList = await api(
    adminToken,
    'GET',
    `/api/v1/admin/users?search=${encodeURIComponent(pendingEmail)}&size=5`,
  );
  const pendingUser = (pendingAdminList.data?.content ?? []).find((user) => user.email === pendingEmail);

  const register = await api(adminToken, 'POST', '/api/v1/auth/register', {
    firstName: 'Audit',
    lastName: 'Reset',
    email: activeEmail,
    password: initialPassword,
  });
  const activeUsername = register.data?.username;

  const mailBefore = await mailhogMessages();
  const forgot = await api(null, 'POST', '/api/v1/auth/forgot-password', { email: activeEmail });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const mailAfter = await mailhogMessages();
  const token = extractResetToken(mailAfter.items, activeEmail);
  const reset = token
    ? await api(null, 'POST', '/api/v1/auth/reset-password', {
      token,
      newPassword: resetPassword,
      confirmPassword: resetPassword,
    })
    : { status: 0, ok: false, data: 'Token absent dans MailHog' };
  const loginAfterReset = await login(activeUsername || activeEmail, resetPassword);

  const badLogin = await api(null, 'POST', '/api/v1/auth/login', {
    identifier: 'admin.cnstn',
    password: 'mauvais',
  });

  const logout = loginAfterReset.ok
    ? await api(loginAfterReset.data.access_token, 'POST', '/api/v1/auth/logout', {
      refresh_token: loginAfterReset.data.refresh_token,
    })
    : { status: 0, ok: false, data: 'Login reset KO' };

  const browser = await chromium.launch({ headless: true });
  let protectedRedirect = false;
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${UI_BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL((url) => url.pathname === '/signin', { timeout: 15000 });
    protectedRedirect = true;
    await ctx.close();
  } finally {
    await browser.close();
  }

  report.dataset = { pendingEmail, activeEmail, activeUsername };
  report.checks = {
    signupStatus: signup.status,
    signupMessage: signup.data?.message ?? '',
    pendingAdminListStatus: pendingAdminList.status,
    pendingVisibleInAdmin: !!pendingUser,
    pendingEnabled: pendingUser?.enabled ?? null,
    registerStatus: register.status,
    activeUsername,
    forgotStatus: forgot.status,
    mailBefore: mailBefore.total,
    mailAfter: mailAfter.total,
    mailIncreased: mailAfter.total > mailBefore.total,
    resetTokenExtracted: !!token,
    resetStatus: reset.status,
    loginAfterResetStatus: loginAfterReset.status,
    logoutStatus: logout.status,
    badLoginStatus: badLogin.status,
    badLoginMessage: badLogin.data?.detail ?? badLogin.data?.message ?? '',
    protectedRedirect,
  };

  await fs.mkdir('../rapport/13-soutenance/evidence', { recursive: true });
  const out = '../rapport/13-soutenance/evidence/auth-recovery-final.json';
  await fs.writeFile(out, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify({ status: 'ok', out, checks: report.checks }, null, 2));
})().catch((error) => {
  console.error(JSON.stringify({ status: 'error', message: error.message, stack: error.stack }, null, 2));
  process.exit(1);
});
