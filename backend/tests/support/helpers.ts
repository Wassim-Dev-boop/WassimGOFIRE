import { Page } from '@playwright/test';

export const TEST_USERS = {
  admin: { username: 'admin.cnstn', password: 'Admin@12345', role: 'ADMIN' },
  employe: { username: 'employe.cnstn', password: 'User@12345', role: 'EMPLOYE' },
  chef: { username: 'chef.cnstn', password: 'User@12345', role: 'CHEF_HIERARCHIQUE' },
  salle: { username: 'salle.cnstn', password: 'User@12345', role: 'RESPONSABLE_SALLE' },
  securite: { username: 'securite.cnstn', password: 'User@12345', role: 'RESPONSABLE_SECURITE' },
  directeur: { username: 'directeur.cnstn', password: 'User@12345', role: 'DIRECTEUR_DSN' },
  qualite: { username: 'qualite.cnstn', password: 'User@12345', role: 'RESPONSABLE_QUALITE' }
};

export async function login(page: Page, user: typeof TEST_USERS.admin) {
  await page.goto('/signin');
  
  // Fill identifier field (username or email)
  await page.fill('input[name="identifier"]', user.username);
  
  // Fill password field
  await page.fill('input[name="password"]', user.password);
  
  // Click Sign in button
  const signInButton = page.locator('button:has-text("Sign in"), button:has-text("Connexion...")').first();
  await signInButton.click();
  
  // Wait for navigation to dashboard
  await page.waitForURL(/dashboard|home|main/, { timeout: 10000 });
}

export async function logout(page: Page) {
  // Click profile menu
  const profileMenu = page.locator('[data-testid="profile-menu"], button:has-text("Profil"), [aria-label*="profile" i]').first();
  if (await profileMenu.isVisible().catch(() => false)) {
    await profileMenu.click().catch(() => {});
  }
  
  // Click logout
  const logoutBtn = page.locator('button:has-text("Déconnexion"), button:has-text("Logout"), a:has-text("Déconnexion")').first();
  try {
    await logoutBtn.click().catch(() => {});
  } catch (e) {
    console.log('Logout button not found');
  }
  
  // Wait for signin, but don't fail if timeout
  try {
    await page.waitForURL(/signin/, { timeout: 3000 });
  } catch (e) {
    console.log('Logout: timeout waiting for signin URL');
  }
}

export async function getToken(page: Page): Promise<string | null> {
  // Try multiple keys (backend stores under 'backend_access_token')
  try {
    const token = await Promise.race([
      page.evaluate(() => {
        return localStorage.getItem('backend_access_token') || 
               localStorage.getItem('access_token') || 
               localStorage.getItem('auth_token');
      }),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 5000); // 5 second timeout
      })
    ]);
    return token;
  } catch (e) {
    return null;
  }
}

export function decodeJwt(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const decoded = Buffer.from(parts[1], 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (e) {
    console.error('Failed to decode JWT:', e);
    return null;
  }
}

export async function apiCall(page: Page, method: string, url: string, data?: any) {
  const token = await getToken(page);
  const headers: any = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await page.evaluate(
    async ({ method, url, data, headers }) => {
      const res = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined
      });
      return {
        status: res.status,
        data: await res.json().catch(() => null)
      };
    },
    { method, url, data, headers }
  );
  
  return response;
}
