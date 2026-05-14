import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const UI_BASE = 'http://localhost:4200';
const API_BASE = 'http://localhost:8088';
const ACCOUNT = { identifier: 'employe.cnstn', password: 'User@12345' };

const report = { timestamp: new Date().toISOString(), api: {}, ui: {} };

async function loginApi() {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: ACCOUNT.identifier, password: ACCOUNT.password }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Login KO: ${response.status} ${text}`);
  return JSON.parse(text).access_token;
}

async function apiRequest(token, method, path, body) {
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

async function uiLogin(page) {
  await page.goto(`${UI_BASE}/signin`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[placeholder="Votre email professionnel"]').first().fill(ACCOUNT.identifier);
  await page.locator('input[placeholder="Votre mot de passe"]').first().fill(ACCOUNT.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForFunction(() => window.location.pathname !== '/signin', null, { timeout: 30000 });
}

(async () => {
  const token = await loginApi();
  const me = await apiRequest(token, 'GET', '/api/v1/me');
  const update = await apiRequest(token, 'PATCH', '/api/v1/me/profile', {
    email: me.data.email,
    firstName: me.data.firstName,
    lastName: me.data.lastName,
    phone: me.data.phone || '+21620000011',
  });
  const reload = await apiRequest(token, 'GET', '/api/v1/me');
  report.api.profile = {
    meStatus: me.status,
    updateStatus: update.status,
    reloadStatus: reload.status,
    username: reload.data?.username,
    email: reload.data?.email,
  };

  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await uiLogin(page);

    await page.goto(`${UI_BASE}/profile`, { waitUntil: 'domcontentloaded' });
    await page.getByText('Informations personnelles').waitFor({ timeout: 20000 });
    report.ui.profileOpened = true;
    const profileInputValues = await page.locator('input').evaluateAll((inputs) => inputs.map((input) => input.value));
    report.ui.profileUserVisible = profileInputValues.includes('employe.cnstn')
      || (await page.getByText('employe.cnstn').count()) > 0;
    await page.getByRole('button', { name: /Enregistrer les modifications|Mise a jour/i }).click();
    await page.getByText(/Profil mis a jour avec succes/i).waitFor({ timeout: 15000 });
    report.ui.profileSaveClicked = true;
    report.ui.profileSaveFeedback = true;
    report.ui.passwordChangeAvailable = (await page.getByText(/changer.*mot de passe|mot de passe actuel/i).count()) > 0;

    const searchInput = page.getByPlaceholder('Rechercher (documents, evenements, salles...)');
    async function search(term, expectedPath) {
      await searchInput.fill(term);
      await searchInput.press('Enter');
      await page.waitForURL((url) => url.pathname === expectedPath, { timeout: 15000 });
      return page.url();
    }
    report.ui.globalSearch = {
      documentUrl: await search('document qualité', '/documents'),
      eventUrl: await search('evenement calendrier', '/events'),
      roomUrl: await search('reservation salle', '/reservations/salles'),
    };

    await ctx.close();
  } finally {
    await browser.close();
  }

  await fs.mkdir('../rapport/13-soutenance/evidence', { recursive: true });
  const out = '../rapport/13-soutenance/evidence/profile-search-final.json';
  await fs.writeFile(out, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify({ status: 'ok', out }, null, 2));
})().catch((error) => {
  console.error(JSON.stringify({ status: 'error', message: error.message, stack: error.stack }, null, 2));
  process.exit(1);
});
