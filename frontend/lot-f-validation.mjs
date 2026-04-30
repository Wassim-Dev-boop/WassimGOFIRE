import { chromium } from 'playwright';

const UI_BASE = 'http://localhost:4200';
const API_BASE = 'http://localhost:8088';

const ACCOUNTS = {
  admin: { identifier: 'admin.cnstn', password: 'Admin@12345' },
  employee: { identifier: 'employe.cnstn', password: 'User@12345' },
  manager: { identifier: 'chef.cnstn', password: 'User@12345' },
  director: { identifier: 'directeur.cnstn', password: 'User@12345' },
  roomManager: { identifier: 'salle.cnstn', password: 'User@12345' },
  itManager: { identifier: 'it.cnstn', password: 'User@12345' },
};

const report = {
  dataset: {},
  api: {},
  ui: {
    roomManager: {},
    itManager: {},
    employee: {},
  },
};

async function apiLogin(identifier, password) {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });

  if (!response.ok) {
    throw new Error(`api login failed for ${identifier}: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  return payload.access_token;
}

async function apiRequest(token, method, path, body, expectOk = true) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (expectOk && !response.ok) {
    throw new Error(`api ${method} ${path} failed: ${response.status} ${text}`);
  }

  return {
    ok: response.ok,
    status: response.status,
    data: parsed,
  };
}

async function uiLogin(page, identifier, password) {
  await page.goto(`${UI_BASE}/signin`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[placeholder="Votre email professionnel"]').first().fill(identifier);
  await page.locator('input[placeholder="Votre mot de passe"]').first().fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(/\/dashboard|\/events|\/invitations|\/documents|\/reservations|\/it/, { timeout: 20000 });
}

async function clickIfVisible(locator) {
  try {
    if ((await locator.count()) === 0) {
      return false;
    }
    await locator.first().click({ timeout: 2500 });
    return true;
  } catch {
    return false;
  }
}

async function prepareDataset(tokens) {
  const myEquipmentsResponse = await apiRequest(tokens.employee, 'GET', '/api/v1/it-equipment/my');
  const myEquipments = Array.isArray(myEquipmentsResponse.data) ? myEquipmentsResponse.data : [];
  if (myEquipments.length === 0) {
    report.api.datasetError = 'Aucun equipement IT affecte a employe.cnstn; workflow non testable.';
    return;
  }

  const equipment = myEquipments[0];
  const uniqueSuffix = Date.now();
  const title = `LOTF-Intervention-${uniqueSuffix}`;
  const createResponse = await apiRequest(tokens.employee, 'POST', '/api/v1/interventions/it', {
    title,
    description: 'Validation automatique Lot F (workflow complet).',
    equipmentId: equipment.id,
    priority: 'MEDIUM',
  }, false);

  if (!createResponse.ok || !createResponse.data?.id) {
    report.api.createInterventionError = typeof createResponse.data === 'object'
      ? createResponse.data?.detail || `HTTP ${createResponse.status}`
      : `HTTP ${createResponse.status}`;
    report.dataset = {
      equipmentId: equipment.id,
      equipmentName: equipment.name,
    };
    return;
  }

  const createdIntervention = createResponse.data;
  report.api.createIntervention = true;
  report.dataset = {
    interventionId: createdIntervention.id,
    interventionTitle: createdIntervention.title,
    equipmentId: equipment.id,
    equipmentName: equipment.name,
  };
}

async function validateWorkflowApi(tokens) {
  const interventionId = report.dataset.interventionId;
  if (!interventionId) {
    report.api.workflowSkipped = true;
    return;
  }

  const unauthorized = await apiRequest(
    tokens.employee,
    'POST',
    `/api/v1/interventions/it/${interventionId}/manager-decision`,
    { approved: true, note: 'Tentative non autorisee' },
    false,
  );
  report.api.employeeForbiddenManagerDecision = unauthorized.status === 403;

  const managerApprove = await apiRequest(tokens.manager, 'POST', `/api/v1/interventions/it/${interventionId}/manager-decision`, {
    approved: true,
    note: 'Validation chef - Lot F',
  });
  report.api.managerApproved = managerApprove.data?.itWorkflowStatus === 'DSN_APPROVAL_PENDING';

  const dsnApprove = await apiRequest(tokens.director, 'POST', `/api/v1/interventions/it/${interventionId}/dsn-decision`, {
    approved: true,
    note: 'Validation DSN - Lot F',
  });
  report.api.dsnApproved = dsnApprove.data?.itWorkflowStatus === 'IT_PROCESSING_PENDING';

  const take = await apiRequest(tokens.itManager, 'POST', `/api/v1/interventions/it/${interventionId}/take`, {
    note: 'Prise en charge IT - Lot F',
  });
  report.api.takenInCharge = take.data?.itWorkflowStatus === 'IT_IN_CHARGE';

  const start = await apiRequest(tokens.itManager, 'POST', `/api/v1/interventions/it/${interventionId}/start`, {
    note: 'Demarrage traitement - Lot F',
  });
  report.api.started = start.data?.itWorkflowStatus === 'IT_IN_PROGRESS';

  const resolve = await apiRequest(tokens.itManager, 'POST', `/api/v1/interventions/it/${interventionId}/resolve`, {
    note: 'Incident resolu pendant validation Lot F',
    equipmentState: 'OPERATIONAL',
  });
  report.api.resolved = resolve.data?.itWorkflowStatus === 'IT_RESOLVED';

  const close = await apiRequest(tokens.itManager, 'POST', `/api/v1/interventions/it/${interventionId}/close`, {
    note: 'Cloture workflow Lot F',
  });
  report.api.closed = close.data?.itWorkflowStatus === 'IT_CLOSED';

  const finalState = await apiRequest(tokens.admin, 'GET', `/api/v1/interventions/it/${interventionId}`);
  report.api.finalStatus = finalState.data?.itWorkflowStatus;
}

async function runUiChecks() {
  const browser = await chromium.launch({ headless: true });
  try {
    // Room manager checks
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await uiLogin(page, ACCOUNTS.roomManager.identifier, ACCOUNTS.roomManager.password);

      await page.goto(`${UI_BASE}/reservations/salles`, { waitUntil: 'domcontentloaded' });
      report.ui.roomManager.roomsPageLoaded = await page.getByRole('heading', { name: 'Reservations des salles' }).isVisible();
      report.ui.roomManager.applyFilters = await clickIfVisible(page.getByRole('button', { name: 'Appliquer' }));
      report.ui.roomManager.resetFilters = await clickIfVisible(page.getByRole('button', { name: 'Reinitialiser' }));

      const firstRoomCard = page.locator('#rooms-inventory-grid article').first();
      if ((await firstRoomCard.count()) > 0) {
        report.ui.roomManager.viewPlanning = await clickIfVisible(firstRoomCard.getByRole('button', { name: 'Voir planning' }));
        await page.waitForTimeout(300);
        report.ui.roomManager.planningModal = (await page.locator('div.fixed.inset-0').count()) > 0;
        await clickIfVisible(page.locator('div.fixed').getByRole('button', { name: 'Fermer' }));
        report.ui.roomManager.reserveActionVisible = (await firstRoomCard.getByRole('button', { name: /Reserver|Indisponible|Reservation indisponible/i }).count()) > 0;
      } else {
        report.ui.roomManager.viewPlanning = false;
        report.ui.roomManager.planningModal = false;
        report.ui.roomManager.reserveActionVisible = false;
      }

      report.ui.roomManager.tabEquipements = await clickIfVisible(page.getByRole('button', { name: 'Equipements logistiques' }));
      if (report.ui.roomManager.tabEquipements) {
        await page.waitForURL(/\/reservations\/equipements/, { timeout: 15000 });
      }
      report.ui.roomManager.equipmentReservationsLoaded = await page.getByRole('heading', { name: 'Reservations equipements' }).isVisible();

      report.ui.roomManager.equipmentPlanning = await clickIfVisible(page.getByRole('button', { name: 'Voir planning' }).first());
      await page.waitForTimeout(300);
      report.ui.roomManager.equipmentPlanningModal = (await page.locator('div.fixed.inset-0').count()) > 0;
      await clickIfVisible(page.locator('div.fixed').getByRole('button', { name: 'Fermer' }));

      await ctx.close();
    }

    // IT manager checks
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await uiLogin(page, ACCOUNTS.itManager.identifier, ACCOUNTS.itManager.password);

      await page.goto(`${UI_BASE}/it/equipements`, { waitUntil: 'domcontentloaded' });
      report.ui.itManager.itEquipmentLoaded = await page.getByRole('heading', { name: 'Parc équipements IT' }).isVisible();
      report.ui.itManager.categoryKpiVisible = (await page.getByText('Catégories IT').count()) > 0;
      report.ui.itManager.filterButton = await clickIfVisible(page.getByRole('button', { name: 'Filtrer' }));
      report.ui.itManager.resetButton = await clickIfVisible(page.getByRole('button', { name: 'Réinitialiser' }));

      const firstEquipmentRow = page.locator('tbody tr').filter({ hasText: 'Modifier' }).first();
      if ((await firstEquipmentRow.count()) > 0) {
        report.ui.itManager.detailsButton = await clickIfVisible(firstEquipmentRow.getByRole('button', { name: 'Détails' }));
        await page.waitForTimeout(300);
        report.ui.itManager.detailsModal = (await page.locator('div.fixed.inset-0').count()) > 0;
        await clickIfVisible(page.locator('div.fixed').getByRole('button', { name: 'Fermer' }));
      } else {
        report.ui.itManager.detailsButton = false;
        report.ui.itManager.detailsModal = false;
      }

      report.ui.itManager.openInterventions = await clickIfVisible(page.getByRole('button', { name: 'Voir interventions IT' }));
      if (report.ui.itManager.openInterventions) {
        await page.waitForURL(/\/it\/interventions/, { timeout: 15000 });
      }
      report.ui.itManager.itInterventionsLoaded = await page.getByRole('heading', { name: 'Interventions IT' }).isVisible();
      report.ui.itManager.interventionsFilters = await clickIfVisible(page.getByRole('button', { name: 'Filtrer' }));
      report.ui.itManager.interventionsReset = await clickIfVisible(page.getByRole('button', { name: 'Réinitialiser' }));

      await ctx.close();
    }

    // Employee checks
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await uiLogin(page, ACCOUNTS.employee.identifier, ACCOUNTS.employee.password);

      await page.goto(`${UI_BASE}/it/interventions`, { waitUntil: 'domcontentloaded' });
      report.ui.employee.itInterventionsLoaded = await page.getByRole('heading', { name: 'Interventions IT' }).isVisible();
      report.ui.employee.newRequestButton = await clickIfVisible(page.getByRole('button', { name: 'Nouvelle demande IT' }));
      report.ui.employee.createFormVisible = (await page.getByPlaceholder('Description du problème').count()) > 0;
      if (!report.ui.employee.createFormVisible && report.ui.employee.newRequestButton) {
        await clickIfVisible(page.getByRole('button', { name: 'Nouvelle demande IT' }));
        report.ui.employee.createFormVisible = (await page.getByPlaceholder('Description du problème').count()) > 0;
      }
      if (report.ui.employee.createFormVisible) {
        await clickIfVisible(page.getByRole('button', { name: 'Annuler' }));
      }

      await page.goto(`${UI_BASE}/it/equipements`, { waitUntil: 'domcontentloaded' });
      report.ui.employee.itEquipmentForbidden = (await page.getByRole('heading', { name: 'Parc équipements IT' }).count()) === 0;

      await ctx.close();
    }
  } finally {
    await browser.close();
  }
}

(async () => {
  const tokens = {
    admin: await apiLogin(ACCOUNTS.admin.identifier, ACCOUNTS.admin.password),
    employee: await apiLogin(ACCOUNTS.employee.identifier, ACCOUNTS.employee.password),
    manager: await apiLogin(ACCOUNTS.manager.identifier, ACCOUNTS.manager.password),
    director: await apiLogin(ACCOUNTS.director.identifier, ACCOUNTS.director.password),
    roomManager: await apiLogin(ACCOUNTS.roomManager.identifier, ACCOUNTS.roomManager.password),
    itManager: await apiLogin(ACCOUNTS.itManager.identifier, ACCOUNTS.itManager.password),
  };

  await prepareDataset(tokens);
  await validateWorkflowApi(tokens);
  await runUiChecks();

  console.log(JSON.stringify({ status: 'ok', report }, null, 2));
})().catch((error) => {
  console.error(JSON.stringify({ status: 'error', message: error.message, stack: error.stack }, null, 2));
  process.exit(1);
});
