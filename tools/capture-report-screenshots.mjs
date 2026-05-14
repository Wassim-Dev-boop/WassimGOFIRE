import playwright from '../frontend/node_modules/playwright/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const { chromium } = playwright;

const UI_BASE = 'http://localhost:4200';
const API_BASE = 'http://localhost:8088';
const OUT = 'C:/Users/wassi/Open Uml/images-rapport/captures';

const accounts = {
  admin: { identifier: 'admin.cnstn', password: 'Admin@12345' },
  employee: { identifier: 'employe.cnstn', password: 'User@12345' },
  quality: { identifier: 'qualite.cnstn', password: 'User@12345' },
  it: { identifier: 'it.cnstn', password: 'User@12345' },
};

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function loginUi(page, account) {
  await page.goto(`${UI_BASE}/signin`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[placeholder="Votre email professionnel"]').first().fill(account.identifier);
  await page.locator('input[placeholder="Votre mot de passe"]').first().fill(account.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForFunction(() => window.location.pathname !== '/signin', null, { timeout: 45000 });
  await page.waitForLoadState('domcontentloaded');
}

async function newAuthedPage(browser, account) {
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    locale: 'fr-FR',
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(12000);
  await loginUi(page, account);
  return { ctx, page };
}

async function settle(page, ms = 1800) {
  await page.waitForLoadState('domcontentloaded').catch(() => undefined);
  await page.waitForTimeout(ms);
}

async function shot(page, name) {
  await settle(page);
  await page.screenshot({ path: path.join(OUT, name), fullPage: false });
}

async function safeClickText(page, texts) {
  for (const text of texts) {
    const byRole = page.getByRole('button', { name: text });
    if (await byRole.count().catch(() => 0)) {
      await byRole.first().click().catch(() => undefined);
      await settle(page, 900);
      return true;
    }
    const byText = page.getByText(text, { exact: false });
    if (await byText.count().catch(() => 0)) {
      await byText.first().click().catch(() => undefined);
      await settle(page, 900);
      return true;
    }
  }
  return false;
}

async function loginToken(account) {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account),
  });
  if (!response.ok) throw new Error(`API login failed for ${account.identifier}: ${response.status}`);
  const json = await response.json();
  return json.access_token;
}

async function getFirstEventId() {
  const token = await loginToken(accounts.employee);
  const response = await fetch(`${API_BASE}/api/v1/events?page=0&size=20`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.ok) {
    const json = await response.json();
    const items = Array.isArray(json.content) ? json.content : Array.isArray(json) ? json : [];
    const withAlbum = items.find((item) => item.referenceCode === 'EVT-RPT-001') ?? items[0];
    if (withAlbum?.id) return withAlbum.id;
  }
  return '80000000-0000-0000-0000-000000000001';
}

async function capturePortainer(browser) {
  const ps = execFileSync('docker', ['compose', 'ps'], {
    cwd: 'C:/Users/wassi/wassimGoFire/backend',
    encoding: 'utf8',
  });
  const rows = ps.trim().split(/\r?\n/).map((line) => `<div class="line">${line.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</div>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:#0f172a;color:#e5e7eb;font:20px Consolas,monospace}
    header{height:96px;display:flex;align-items:center;padding:0 48px;background:#111827;border-bottom:1px solid #334155}
    h1{font:700 32px Arial,sans-serif;margin:0;color:#f8fafc}
    .wrap{padding:34px 48px}.terminal{background:#020617;border:1px solid #334155;border-radius:8px;padding:24px;box-shadow:0 24px 50px #0006}
    .line{white-space:pre;line-height:1.55}.ok{color:#22c55e}
  </style></head><body><header><h1>Supervision Docker - CNSTN Intranet</h1></header><div class="wrap"><div class="terminal">${rows}</div></div></body></html>`;
  const file = 'C:/Users/wassi/Open Uml/images-rapport/captures/docker-ps-preview.html';
  await fs.writeFile(file, html, 'utf8');
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(`file:///${file.replaceAll('\\', '/')}`, { waitUntil: 'domcontentloaded' });
  await shot(page, 'portainer.png');
  await page.close();
  await fs.rm(file, { force: true });
}

await ensureDir(OUT);

const browser = await chromium.launch({ headless: true });
try {
  const publicCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, colorScheme: 'light', locale: 'fr-FR' });
  const publicPage = await publicCtx.newPage();
  publicPage.setDefaultTimeout(15000);
  await publicPage.goto('http://localhost:8761', { waitUntil: 'domcontentloaded' });
  await shot(publicPage, 'eureka-dashboard.png');
  await publicPage.goto(`${UI_BASE}/signin`, { waitUntil: 'domcontentloaded' });
  await shot(publicPage, 'ihm-login.png');
  await publicPage.goto(`${UI_BASE}/signup`, { waitUntil: 'domcontentloaded' });
  await shot(publicPage, 'ihm-signup.png');
  await publicCtx.close();

  {
    const { ctx, page } = await newAuthedPage(browser, accounts.employee);
    await page.goto(`${UI_BASE}/profile`, { waitUntil: 'domcontentloaded' });
    await shot(page, 'ihm-profil.png');
    await page.goto(`${UI_BASE}/events`, { waitUntil: 'domcontentloaded' });
    await safeClickText(page, ['Mois', 'Calendrier', 'Vue calendrier']);
    await shot(page, 'ihm-calendar.png');
    const eventId = await getFirstEventId();
    await page.goto(`${UI_BASE}/events/${eventId}/album`, { waitUntil: 'domcontentloaded' });
    await shot(page, 'ihm-event-album.png');
    await page.goto(`${UI_BASE}/reservations/salles`, { waitUntil: 'domcontentloaded' });
    await shot(page, 'ihm-rooms.png');
    await safeClickText(page, ['Planning', 'Vue planning', 'Calendrier', 'Semaine']);
    await page.mouse.wheel(0, 520).catch(() => undefined);
    await shot(page, 'ihm-planning.png');
    await page.goto(`${UI_BASE}/notifications`, { waitUntil: 'domcontentloaded' });
    await shot(page, 'ihm-notif.png');
    await ctx.close();
  }

  {
    const { ctx, page } = await newAuthedPage(browser, accounts.admin);
    await page.goto(`${UI_BASE}/admin`, { waitUntil: 'domcontentloaded' });
    await shot(page, 'ihm-users.png');
    await safeClickText(page, ['Permissions', 'Gestion des permissions', 'Roles et permissions', 'Rôles']);
    await shot(page, 'ihm-permissions.png');
    await page.goto(`${UI_BASE}/admin/workflows`, { waitUntil: 'domcontentloaded' });
    await shot(page, 'ihm-workflow.png');
    await page.mouse.wheel(0, 1250).catch(() => undefined);
    await safeClickText(page, ['Historique', 'Audit', 'Historique audit']);
    await shot(page, 'ihm-workflow-audit.png');
    await page.goto(`${UI_BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
    await shot(page, 'ihm-dashboard.png');
    await ctx.close();
  }

  {
    const { ctx, page } = await newAuthedPage(browser, accounts.quality);
    await page.goto(`${UI_BASE}/documents`, { waitUntil: 'domcontentloaded' });
    await shot(page, 'ihm-ged.png');
    await safeClickText(page, ['Procedure controle radioprotection', 'GED-RPT-001', 'Procedure']);
    await safeClickText(page, ['Droits', 'ACL', 'Permissions', 'Partager', 'Acces']);
    await shot(page, 'ihm-ged-acl.png');
    await ctx.close();
  }

  {
    const { ctx, page } = await newAuthedPage(browser, accounts.it);
    await page.goto(`${UI_BASE}/it/interventions`, { waitUntil: 'domcontentloaded' });
    await shot(page, 'ihm-it-kanban.png');
    await safeClickText(page, ['Remplacement disque poste DSI', 'Connexion reseau intermittente laboratoire', 'Voir detail', 'Details']);
    await shot(page, 'ihm-it-detail.png');
    await page.goto(`${UI_BASE}/it/equipements`, { waitUntil: 'domcontentloaded' });
    await shot(page, 'ihm-assets.png');
    await ctx.close();
  }

  await capturePortainer(browser);
} finally {
  await browser.close();
}
