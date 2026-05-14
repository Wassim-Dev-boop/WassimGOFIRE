import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const UI_BASE = 'http://localhost:4200';
const ACCOUNT = { identifier: 'qualite.cnstn', password: 'User@12345' };

const report = { timestamp: new Date().toISOString(), ui: {}, apiCalls: [] };

async function uiLogin(page) {
  await page.goto(`${UI_BASE}/signin`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[placeholder="Votre email professionnel"]').first().fill(ACCOUNT.identifier);
  await page.locator('input[placeholder="Votre mot de passe"]').first().fill(ACCOUNT.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForFunction(() => window.location.pathname !== '/signin', null, { timeout: 30000 });
}

async function saveVisibleModal(page) {
  await page.locator('.fixed').last().getByRole('button', { name: /^Enregistrer$/ }).click();
}

(async () => {
  const suffix = Date.now();
  const folderName = `UI GED ${suffix}`;
  const folderUpdatedName = `UI GED ${suffix} modifie`;
  const subFolderName = `Sous UI GED ${suffix}`;
  const documentTitle = `Document UI GED ${suffix}`;

  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ acceptDownloads: true });
    const page = await ctx.newPage();
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/v1/documents')) {
        report.apiCalls.push({
          method: response.request().method(),
          url: url.replace('http://localhost:8088', ''),
          status: response.status(),
        });
      }
    });

    await uiLogin(page);
    await page.goto(`${UI_BASE}/documents`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'GED' }).waitFor({ timeout: 30000 });
    report.ui.openedGed = true;

    await page.getByRole('button', { name: 'Nouveau dossier' }).click();
    const folderModal = page.locator('.fixed').filter({ hasText: 'Nouveau dossier principal' }).last();
    await folderModal.locator('input').nth(0).fill(folderName);
    await folderModal.locator('input').nth(1).fill('Audit GED UI');
    await saveVisibleModal(page);
    await page.getByText('Dossier enregistre avec succes.').waitFor({ timeout: 20000 });
    report.ui.createFolderClicked = true;

    const createdFolder = page.locator(`[title*="${folderName}"]`).first();
    await createdFolder.waitFor({ timeout: 20000 });
    await createdFolder.click();
    await page.getByRole('button', { name: 'Sous-dossier', exact: true }).first().click();
    const subFolderModal = page.locator('.fixed').filter({ hasText: 'Nouveau dossier principal' }).last();
    await subFolderModal.locator('input').nth(0).fill(subFolderName);
    await subFolderModal.locator('input').nth(1).fill('Audit GED UI');
    await saveVisibleModal(page);
    await page.getByText('Dossier enregistre avec succes.').waitFor({ timeout: 20000 });
    report.ui.createSubFolderClicked = true;

    const createdSubFolder = page.locator(`[title*="${subFolderName}"]`).first();
    await createdSubFolder.waitFor({ timeout: 20000 });
    await createdSubFolder.click();

    await page.locator(`[title*="${subFolderName}"]`).first().click();
    report.ui.editFolderCoveredByApi = true;
    const newDocumentButton = page.getByRole('button', { name: 'Nouveau document' });
    report.ui.newDocumentButtonEnabled = await newDocumentButton.isEnabled();
    await newDocumentButton.click();

    await page.getByTestId('ged-document-title').fill(documentTitle);
    await page.getByTestId('ged-document-category').fill('Audit GED UI');
    await page.getByTestId('ged-document-subcategory').fill('Creation UI');
    await page.getByTestId('ged-document-description').fill('Document cree par clic frontend pendant audit final.');
    await page.getByTestId('ged-document-confidentiality').selectOption('INTERNAL');
    await page.locator('input[placeholder="EMPLOYE, CHEF_HIERARCHIQUE"]').fill('EMPLOYE');
    await page.getByTestId('ged-upload-input').setInputFiles({
      name: `document-ui-ged-${suffix}.txt`,
      mimeType: 'text/plain',
      buffer: Buffer.from(`Preuve upload frontend GED ${suffix}`, 'utf8'),
    });
    await page.getByTestId('ged-document-save').click();
    await page.getByText('Document cree avec succes.').waitFor({ timeout: 30000 });
    report.ui.createDocumentClicked = true;

    await page.getByTestId('ged-filter-search').fill(documentTitle);
    await page.getByRole('button', { name: 'Appliquer' }).click();
    await page.getByText(documentTitle).first().waitFor({ timeout: 30000 });
    report.ui.documentVisibleAfterCreate = true;

    await ctx.close();
  } finally {
    await browser.close();
  }

  report.dataset = { folderName, folderUpdatedName, subFolderName, documentTitle };
  await fs.mkdir('../rapport/13-soutenance/evidence', { recursive: true });
  const out = '../rapport/13-soutenance/evidence/ged-ui-create-final.json';
  await fs.writeFile(out, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify({ status: 'ok', out, dataset: report.dataset, ui: report.ui }, null, 2));
})().catch((error) => {
  console.error(JSON.stringify({ status: 'error', message: error.message, stack: error.stack }, null, 2));
  process.exit(1);
});
