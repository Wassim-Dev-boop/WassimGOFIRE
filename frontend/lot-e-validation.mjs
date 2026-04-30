import { chromium } from 'playwright';

const UI_BASE = 'http://localhost:4200';
const API_BASE = 'http://localhost:8088';

const ACCOUNTS = {
  admin: { identifier: 'admin.cnstn', password: 'Admin@12345' },
  employee: { identifier: 'employe.cnstn', password: 'User@12345' },
  manager: { identifier: 'chef.cnstn', password: 'User@12345' },
  quality: { identifier: 'qualite.cnstn', password: 'User@12345' },
};

const report = {
  dataset: {},
  ui: {
    manager: {},
    employee: {},
    quality: {},
    admin: {},
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

async function apiRequest(token, method, path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`api ${method} ${path} failed: ${response.status} ${await response.text()}`);
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function uiLogin(page, identifier, password) {
  await page.goto(`${UI_BASE}/signin`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[placeholder="Votre email professionnel"]').first().fill(identifier);
  await page.locator('input[placeholder="Votre mot de passe"]').first().fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(/\/dashboard|\/events|\/invitations/, { timeout: 20000 });
}

async function clickIfVisible(locator) {
  try {
    if ((await locator.count()) === 0) {
      return false;
    }
    await locator.first().click({ timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

async function closeBlockingModal(page) {
  await clickIfVisible(page.getByRole('button', { name: 'Fermer' }));
  await clickIfVisible(page.getByRole('button', { name: 'Annuler' }));
  try {
    await page.keyboard.press('Escape');
  } catch {
    // no-op
  }
}

async function ensureInvitation(tokenSender, eventId, recipient, message) {
  await apiRequest(tokenSender, 'POST', `/api/v1/events/${eventId}/invitations`, {
    recipients: [
      {
        username: recipient.username,
        email: recipient.email,
        displayName: recipient.displayName,
      },
    ],
    message,
  });
}

async function prepareDataset() {
  const tokens = {
    admin: await apiLogin(ACCOUNTS.admin.identifier, ACCOUNTS.admin.password),
    employee: await apiLogin(ACCOUNTS.employee.identifier, ACCOUNTS.employee.password),
    manager: await apiLogin(ACCOUNTS.manager.identifier, ACCOUNTS.manager.password),
    quality: await apiLogin(ACCOUNTS.quality.identifier, ACCOUNTS.quality.password),
  };

  const profiles = {
    admin: await apiRequest(tokens.admin, 'GET', '/api/v1/me'),
    employee: await apiRequest(tokens.employee, 'GET', '/api/v1/me'),
    manager: await apiRequest(tokens.manager, 'GET', '/api/v1/me'),
    quality: await apiRequest(tokens.quality, 'GET', '/api/v1/me'),
  };

  const managerEventsPage = await apiRequest(tokens.manager, 'GET', '/api/v1/events?page=0&size=20&sort=startAt,desc');
  const events = Array.isArray(managerEventsPage?.content) ? managerEventsPage.content : [];
  if (events.length === 0) {
    throw new Error('aucun evenement disponible pour les validations Lot E.');
  }

  const targetEvent = events[0];

  const employeeInvitations = await apiRequest(tokens.employee, 'GET', '/api/v1/events/invitations/mine');
  const hasEmployeePending = Array.isArray(employeeInvitations)
    && employeeInvitations.some((inv) => inv.eventId === targetEvent.id && inv.invitedUsername === profiles.employee.username && inv.status === 'PENDING');

  if (!hasEmployeePending) {
    await ensureInvitation(tokens.employee, targetEvent.id, {
      username: profiles.employee.username,
      email: profiles.employee.email || 'employe@cnstn.tn',
      displayName: `${profiles.employee.firstName || ''} ${profiles.employee.lastName || ''}`.trim() || profiles.employee.username,
    }, 'Invitation employee - Lot E');
  }

  const qualityInvitations = await apiRequest(tokens.quality, 'GET', '/api/v1/events/invitations/mine');
  const hasQualityPending = Array.isArray(qualityInvitations)
    && qualityInvitations.some((inv) => inv.eventId === targetEvent.id && inv.invitedUsername === profiles.quality.username && inv.status === 'PENDING');

  if (!hasQualityPending) {
    await ensureInvitation(tokens.employee, targetEvent.id, {
      username: profiles.quality.username,
      email: profiles.quality.email || 'qualite@cnstn.tn',
      displayName: `${profiles.quality.firstName || ''} ${profiles.quality.lastName || ''}`.trim() || profiles.quality.username,
    }, 'Invitation qualite - Lot E');
  }

  report.dataset = {
    targetEventId: targetEvent.id,
    targetEventTitle: targetEvent.title,
    targetEventStatus: targetEvent.status,
    targetWorkflowStep: targetEvent.workflowStep,
    profiles: {
      admin: profiles.admin.username,
      employee: profiles.employee.username,
      manager: profiles.manager.username,
      quality: profiles.quality.username,
    },
  };
}

async function runUiChecks() {
  const browser = await chromium.launch({ headless: true });
  try {
    const title = report.dataset.targetEventTitle;
    const eventId = report.dataset.targetEventId;

    // Manager checks
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await uiLogin(page, ACCOUNTS.manager.identifier, ACCOUNTS.manager.password);

      await page.goto(`${UI_BASE}/events`, { waitUntil: 'domcontentloaded' });
      report.ui.manager.eventsLoaded = await page.getByRole('heading', { name: 'Evenements' }).isVisible();
      report.ui.manager.applyFilters = await clickIfVisible(page.getByRole('button', { name: 'Appliquer' }));
      report.ui.manager.resetFilters = await clickIfVisible(page.getByRole('button', { name: 'Reinitialiser' }));

      report.ui.manager.calendarView = await clickIfVisible(
        page.locator('section').first().getByRole('button', { name: /Voir calendrier|Vue calendrier/i }),
      );
      if (report.ui.manager.calendarView) {
        try {
          await page.locator('.fc').first().waitFor({ timeout: 8000 });
        } catch {
          // calendar not visible in time window
        }
      }
      report.ui.manager.calendarVisible = (await page.locator('.fc').count()) > 0;

      report.ui.manager.newEvent = await clickIfVisible(page.getByRole('button', { name: 'Nouvel evenement' }));
      if (report.ui.manager.newEvent) {
        report.ui.manager.newEventModal = (await page.getByRole('heading', { name: 'Ajouter evenement' }).count()) > 0;
        await closeBlockingModal(page);
      }

      await closeBlockingModal(page);
      await clickIfVisible(page.getByRole('button', { name: /Voir la liste|Vue liste/i }));
      await page.getByPlaceholder('Rechercher un evenement, lieu, organisateur...').fill(title);
      await clickIfVisible(page.getByRole('button', { name: 'Appliquer' }));
      const eventCard = page.locator('article').filter({ hasText: title }).first();
      await eventCard.waitFor({ timeout: 15000 });

      report.ui.manager.viewDetail = await clickIfVisible(eventCard.getByRole('button', { name: 'Voir detail' }));
      report.ui.manager.detailModal = (await page.getByText('Detail evenement').count()) > 0;
      if (report.ui.manager.detailModal) {
        report.ui.manager.editButtonVisible = (await page.getByRole('button', { name: 'Modifier evenement' }).count()) > 0;
        if (report.ui.manager.editButtonVisible) {
          await clickIfVisible(page.getByRole('button', { name: 'Modifier evenement' }));
          report.ui.manager.editModalOpened = (await page.getByRole('heading', { name: 'Modifier evenement' }).count()) > 0;
          if (report.ui.manager.editModalOpened) {
            await clickIfVisible(page.getByRole('button', { name: 'Annuler' }));
          }
          // Retour detail event si la modale edition n'est pas ouverte.
          if (!report.ui.manager.editModalOpened) {
            await closeBlockingModal(page);
          }
        }
        report.ui.manager.joinOnline = await clickIfVisible(page.getByRole('button', { name: 'Rejoindre en ligne' }));
      }

      await closeBlockingModal(page);
      report.ui.manager.downloadPdf = await clickIfVisible(eventCard.getByRole('button', { name: /Telecharger PDF officiel/i }));
      report.ui.manager.albumPhotos = await clickIfVisible(eventCard.getByRole('button', { name: 'Album photos' }));
      if (report.ui.manager.albumPhotos) {
        await page.waitForURL(/\/events\/.*\/album/, { timeout: 15000 });
        report.ui.manager.albumLoaded = (await page.getByRole('heading', { name: 'Album photos' }).count()) > 0;
      }

      await ctx.close();
    }

    // Employee checks
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await uiLogin(page, ACCOUNTS.employee.identifier, ACCOUNTS.employee.password);

      await page.goto(`${UI_BASE}/invitations`, { waitUntil: 'domcontentloaded' });
      report.ui.employee.invitationsLoaded = await page.getByRole('heading', { name: 'Invitations' }).isVisible();
      report.ui.employee.filterButton = await clickIfVisible(page.getByRole('button', { name: /Appliquer|Filtrer/i }));
      report.ui.employee.resetButton = await clickIfVisible(page.getByRole('button', { name: 'Réinitialiser' }));

      await page.getByPlaceholder('Rechercher par événement, expéditeur ou partenaire...').fill(title);
      await clickIfVisible(page.getByRole('button', { name: /Appliquer|Filtrer/i }));
      const inviteCard = page.locator('article').filter({ hasText: title }).first();
      await inviteCard.waitFor({ timeout: 15000 });

      report.ui.employee.detailsButton = await clickIfVisible(inviteCard.getByRole('button', { name: 'Détails' }));
      if (report.ui.employee.detailsButton) {
        await page.waitForTimeout(500);
        report.ui.employee.detailsModal = (await page.getByText("Détails de l'invitation").count()) > 0;
        await closeBlockingModal(page);
      }

      const inviteCardForView = page.locator('article').filter({ hasText: title }).first();
      report.ui.employee.viewEventButton = await clickIfVisible(inviteCardForView.getByRole('button', { name: /Voir evenement|Voir l'événement/i }));
      if (report.ui.employee.viewEventButton) {
        await page.waitForURL(/\/events/, { timeout: 15000 });
        report.ui.employee.eventOpened = (await page.getByText(title).count()) > 0;
        report.ui.employee.calendarVisible = (await page.locator('.fc').count()) > 0;
        report.ui.employee.joinOnlineVisible = (await page.getByRole('button', { name: 'Rejoindre en ligne' }).count()) > 0;
      }

      await page.goto(`${UI_BASE}/invitations`, { waitUntil: 'domcontentloaded' });
      await page.getByPlaceholder('Rechercher par événement, expéditeur ou partenaire...').fill(title);
      await clickIfVisible(page.getByRole('button', { name: /Appliquer|Filtrer/i }));
      const inviteCard2 = page.locator(`article:has-text(\"${title}\"):has(button:has-text(\"Accepter\"))`).first();
      report.ui.employee.acceptButton = (await inviteCard2.count()) > 0
        ? await clickIfVisible(inviteCard2.getByRole('button', { name: 'Accepter' }))
        : false;
      await page.waitForTimeout(600);
      report.ui.employee.acceptFeedback = (await page.getByText(/Invitation accept/i).count()) > 0;

      await ctx.close();
    }

    // Quality checks
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await uiLogin(page, ACCOUNTS.quality.identifier, ACCOUNTS.quality.password);

      await page.goto(`${UI_BASE}/invitations`, { waitUntil: 'domcontentloaded' });
      await page.getByPlaceholder('Rechercher par événement, expéditeur ou partenaire...').fill(title);
      await clickIfVisible(page.getByRole('button', { name: /Appliquer|Filtrer/i }));
      const inviteCard = page.locator(`article:has-text(\"${title}\"):has(button:has-text(\"Refuser\"))`).first();
      report.ui.quality.declineButton = (await inviteCard.count()) > 0
        ? await clickIfVisible(inviteCard.getByRole('button', { name: 'Refuser' }))
        : false;
      if (report.ui.quality.declineButton) {
        await page.waitForTimeout(600);
        report.ui.quality.declineModal = (await page.getByRole('heading', { name: 'Refuser l invitation' }).count()) > 0;
        if (report.ui.quality.declineModal) {
          await page.getByPlaceholder('Indiquez un motif de refus...').fill('Indisponibilite');
          await clickIfVisible(page.getByRole('button', { name: 'Confirmer le refus' }));
          await page.waitForTimeout(600);
          report.ui.quality.declineFeedback = (await page.getByText(/Invitation refus/i).count()) > 0;
        } else {
          report.ui.quality.declineFeedback = false;
        }
      }

      await ctx.close();
    }

    // Admin consultation and workflow action visibility.
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await uiLogin(page, ACCOUNTS.admin.identifier, ACCOUNTS.admin.password);

      await page.goto(`${UI_BASE}/events`, { waitUntil: 'domcontentloaded' });
      report.ui.admin.eventsLoaded = await page.getByRole('heading', { name: 'Evenements' }).isVisible();
      await page.getByPlaceholder('Rechercher un evenement, lieu, organisateur...').fill(title);
      await clickIfVisible(page.getByRole('button', { name: 'Appliquer' }));

      const eventCard = page.locator('article').filter({ hasText: title }).first();
      await eventCard.waitFor({ timeout: 15000 });
      report.ui.admin.approveVisible = (await eventCard.getByRole('button', { name: /Valider|Approuver/i }).count()) > 0;
      report.ui.admin.rejectVisible = (await eventCard.getByRole('button', { name: 'Refuser' }).count()) > 0;

      await ctx.close();
    }
  } finally {
    await browser.close();
  }
}

(async () => {
  await prepareDataset();
  await runUiChecks();
  console.log(JSON.stringify({ status: 'ok', report }, null, 2));
})().catch((error) => {
  console.error(JSON.stringify({ status: 'error', message: error.message, stack: error.stack }, null, 2));
  process.exit(1);
});
