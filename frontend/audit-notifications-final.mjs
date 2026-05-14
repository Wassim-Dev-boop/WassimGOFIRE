import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const UI_BASE = 'http://localhost:4200';
const API_BASE = 'http://localhost:8088';
const NOTIFICATION_BASE = 'http://localhost:8086';
const MAILHOG_BASE = 'http://localhost:8025';
const INTERNAL_KEY = 'cnstn-internal-api-key-change-me';

const ACCOUNTS = {
  employee: { identifier: 'employe.cnstn', password: 'User@12345' },
  admin: { identifier: 'admin.cnstn', password: 'Admin@12345' },
  quality: { identifier: 'qualite.cnstn', password: 'User@12345' },
  director: { identifier: 'directeur.cnstn', password: 'User@12345' },
  room: { identifier: 'salle.cnstn', password: 'User@12345' },
};

const report = { timestamp: new Date().toISOString(), dataset: {}, api: {}, ui: {} };

async function login(account) {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: account.identifier, password: account.password }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Login KO ${account.identifier}: ${response.status} ${text}`);
  return JSON.parse(text).access_token;
}

async function request(token, method, path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
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

async function uiLogin(page, account) {
  await page.goto(`${UI_BASE}/signin`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[placeholder="Votre email professionnel"]').first().fill(account.identifier);
  await page.locator('input[placeholder="Votre mot de passe"]').first().fill(account.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForFunction(() => window.location.pathname !== '/signin', null, { timeout: 30000 });
}

(async () => {
  const tokens = {
    employee: await login(ACCOUNTS.employee),
    admin: await login(ACCOUNTS.admin),
    quality: await login(ACCOUNTS.quality),
    director: await login(ACCOUNTS.director),
    room: await login(ACCOUNTS.room),
  };
  const suffix = Date.now();
  const title = `Notification audit ${suffix}`;

  const mailBefore = await fetch(`${MAILHOG_BASE}/api/v2/messages`).then((r) => r.json()).catch(() => ({ total: null }));
  const internalCreate = await fetch(`${NOTIFICATION_BASE}/internal/v1/notifications/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': INTERNAL_KEY,
    },
    body: JSON.stringify({
      recipientUsername: 'employe.cnstn',
      recipientEmail: 'employe@cnstn.tn',
      title,
      message: 'Notification créée pendant audit complet réel.',
      notificationType: 'system',
      inAppOnly: false,
    }),
  });
  report.api.internalCreate = { status: internalCreate.status };
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const mailAfter = await fetch(`${MAILHOG_BASE}/api/v2/messages`).then((r) => r.json()).catch(() => ({ total: null }));
  report.api.mailhogAfterCreate = { before: mailBefore.total, after: mailAfter.total };

  const listUnread = await request(tokens.employee, 'GET', `/api/v1/notifications?unread=true&search=${encodeURIComponent(title)}&page=0&size=10&sort=createdAt,desc`);
  const notification = Array.isArray(listUnread.data?.content) ? listUnread.data.content[0] : null;
  report.api.listUnread = { status: listUnread.status, found: !!notification, id: notification?.id, read: notification?.read };

  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await uiLogin(page, ACCOUNTS.employee);
    await page.goto(`${UI_BASE}/notifications`, { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('Recherche titre ou message').fill(title);
    await page.getByRole('button', { name: 'Appliquer' }).click();
    await page.getByText(title).waitFor({ timeout: 20000 });
    report.ui.employeeNotificationVisible = true;
    await page.locator('article').filter({ hasText: title }).first().click();
    await page.waitForTimeout(1000);
    report.ui.employeeClickedNotification = true;
    await page.getByRole('button', { name: 'Tout marquer comme lu' }).click().catch(() => undefined);
    report.ui.employeeReadAllButtonPresent = (await page.getByRole('button', { name: 'Tout marquer comme lu' }).count()) > 0;
    await ctx.close();

    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await uiLogin(adminPage, ACCOUNTS.admin);
    await adminPage.goto(`${UI_BASE}/notifications`, { waitUntil: 'domcontentloaded' });
    report.ui.adminEmailLogsToggle = await adminPage.getByRole('button', { name: /Afficher logs e-mail|Masquer logs e-mail/i }).count() > 0;
    if (report.ui.adminEmailLogsToggle) {
      await adminPage.getByRole('button', { name: /Afficher logs e-mail/i }).click();
      await adminPage.getByRole('button', { name: 'Filtrer les logs' }).click();
      await adminPage.waitForTimeout(1000);
      report.ui.adminEmailLogsVisible = (await adminPage.getByText(/SENT|FAILED|SKIPPED|Envoyé|Echec|Ignoré/i).count()) > 0
        || (await adminPage.getByText(/Aucun log e-mail disponible/i).count()) > 0;
    }
    await adminCtx.close();
  } finally {
    await browser.close();
  }

  const afterClick = await request(tokens.employee, 'GET', `/api/v1/notifications?search=${encodeURIComponent(title)}&page=0&size=10&sort=createdAt,desc`);
  const afterNotification = Array.isArray(afterClick.data?.content) ? afterClick.data.content[0] : null;
  report.api.afterUiClick = { status: afterClick.status, read: afterNotification?.read ?? afterNotification?.isRead };

  const readAll = await request(tokens.employee, 'PUT', '/api/v1/notifications/read-all');
  const unreadCount = await request(tokens.employee, 'GET', '/api/v1/notifications/unread-count');
  report.api.readAll = { status: readAll.status, unreadCountStatus: unreadCount.status, count: unreadCount.data?.count };

  const emailLogsAdmin = await request(tokens.admin, 'GET', `/api/v1/notifications/email-logs?page=0&size=10&sort=attemptedAt,desc`);
  const emailLogsQuality = await request(tokens.quality, 'GET', `/api/v1/notifications/email-logs?page=0&size=1`);
  const emailLogsDirector = await request(tokens.director, 'GET', `/api/v1/notifications/email-logs?page=0&size=1`);
  const emailLogsRoom = await request(tokens.room, 'GET', `/api/v1/notifications/email-logs?page=0&size=1`);
  const emailLogsEmployee = await request(tokens.employee, 'GET', `/api/v1/notifications/email-logs?page=0&size=1`);
  report.api.emailLogsAccess = {
    adminStatus: emailLogsAdmin.status,
    qualityStatus: emailLogsQuality.status,
    directorStatus: emailLogsDirector.status,
    roomStatus: emailLogsRoom.status,
    employeeStatus: emailLogsEmployee.status,
    adminCount: Array.isArray(emailLogsAdmin.data?.content) ? emailLogsAdmin.data.content.length : null,
  };

  const emailStatus = await request(tokens.admin, 'GET', `/api/v1/notifications/${notification.id}/email-status`);
  const mailBeforeResend = await fetch(`${MAILHOG_BASE}/api/v2/messages`).then((r) => r.json()).catch(() => ({ total: null }));
  const resend = await request(tokens.admin, 'POST', `/api/v1/notifications/${notification.id}/resend-email`);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const mailAfterResend = await fetch(`${MAILHOG_BASE}/api/v2/messages`).then((r) => r.json()).catch(() => ({ total: null }));
  report.api.emailStatusAndResend = {
    statusStatus: emailStatus.status,
    deliveryStatus: emailStatus.data?.emailDeliveryStatus,
    resendStatus: resend.status,
    resendDeliveryStatus: resend.data?.emailDeliveryStatus,
    mailhogBefore: mailBeforeResend.total,
    mailhogAfter: mailAfterResend.total,
  };

  report.dataset = { notificationId: notification?.id, title };
  await fs.mkdir('../rapport/13-soutenance/evidence', { recursive: true });
  const out = '../rapport/13-soutenance/evidence/notifications-final.json';
  await fs.writeFile(out, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify({ status: 'ok', out, dataset: report.dataset }, null, 2));
})().catch((error) => {
  console.error(JSON.stringify({ status: 'error', message: error.message, stack: error.stack }, null, 2));
  process.exit(1);
});
