import { expect, test, type ConsoleMessage, type Page, type Response } from '@playwright/test';
import { login, TEST_USERS } from '../support/helpers';

type AuditIssue = {
  category: 'pageerror' | 'console' | 'network';
  details: string;
};

function shouldIgnoreNetworkIssue(response: Response): boolean {
  const url = response.url();

  // Ignore dev-tools noise and browser internals that do not affect application behavior.
  if (url.includes('chrome-error://') || url.includes('devtools://')) {
    return true;
  }

  // Ignore source maps if they are missing in production bundles.
  if (url.endsWith('.map') && response.status() === 404) {
    return true;
  }

  return false;
}

function shouldIgnoreConsoleError(message: ConsoleMessage): boolean {
  const text = message.text().toLowerCase();

  // Browsers may emit noise for blocked third-party scripts not used by app behavior.
  if (text.includes('favicon') && text.includes('404')) {
    return true;
  }

  return false;
}

async function collectIssuesForJourney(page: Page, routes: string[]): Promise<AuditIssue[]> {
  const issues: AuditIssue[] = [];

  page.on('pageerror', (error) => {
    issues.push({
      category: 'pageerror',
      details: error.message,
    });
  });

  page.on('console', (message) => {
    if (message.type() === 'error' && !shouldIgnoreConsoleError(message)) {
      issues.push({
        category: 'console',
        details: message.text(),
      });
    }
  });

  page.on('response', (response) => {
    const status = response.status();
    if (status >= 400 && !shouldIgnoreNetworkIssue(response)) {
      issues.push({
        category: 'network',
        details: `${status} ${response.request().method()} ${response.url()}`,
      });
    }
  });

  for (const route of routes) {
    await page.goto(route, { waitUntil: 'networkidle' });
  }

  return issues;
}

function formatIssues(issues: AuditIssue[]): string {
  return issues.map((issue) => `[${issue.category}] ${issue.details}`).join('\n');
}

test.describe('Console and Network Audit', () => {
  test('Auth and Admin journeys have no critical console/network issues', async ({ page }) => {
    await login(page, TEST_USERS.admin);

    const issues = await collectIssuesForJourney(page, [
      '/dashboard',
      '/admin',
      '/events',
      '/reservations/salles',
      '/interventions',
      '/documents',
    ]);

    expect(issues, formatIssues(issues)).toEqual([]);
  });

  test('Employee journey has no critical console/network issues', async ({ page }) => {
    await login(page, TEST_USERS.employe);

    const issues = await collectIssuesForJourney(page, [
      '/dashboard',
      '/events',
      '/reservations/salles',
      '/reservations/equipements',
      '/interventions',
      '/documents',
    ]);

    expect(issues, formatIssues(issues)).toEqual([]);
  });

  test('Validation journeys (chef/security/dsn/quality) have no critical issues', async ({ page }) => {
    await login(page, TEST_USERS.chef);
    let issues = await collectIssuesForJourney(page, ['/events', '/validations/events']);

    await login(page, TEST_USERS.securite);
    issues = issues.concat(await collectIssuesForJourney(page, ['/reservations/salles', '/security/conflicts']));

    await login(page, TEST_USERS.directeur);
    issues = issues.concat(await collectIssuesForJourney(page, ['/dashboard', '/partners/pending']));

    await login(page, TEST_USERS.qualite);
    issues = issues.concat(await collectIssuesForJourney(page, ['/documents', '/ged/pending-approval']));

    expect(issues, formatIssues(issues)).toEqual([]);
  });
});
