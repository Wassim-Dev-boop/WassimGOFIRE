import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';
import { Router } from '@angular/router';
import {
  buildApiUrl,
} from '../config/backend-api.config';
import { AppRole, AppUserProfile } from '../models/auth.model';
import { toFrontendRoles } from '../utils/role-mapper.util';

interface BackendDepartmentResponse {
  name?: string;
}

interface BackendProfileResponse {
  id?: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  department?: BackendDepartmentResponse;
  roles?: string[];
}

interface BackendMyPermissionsResponse {
  customized?: boolean;
  effectivePermissions?: string[];
}

interface KeycloakTokenResponse {
  access_token?: string;
}

interface KeycloakJwtPayload {
  sub?: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  realm_access?: {
    roles?: string[];
  };
}

interface SignUpRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

interface PasswordRecoveryResponse {
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly storageKey = 'enterprise-auth-user';
  private readonly permissionStorageKey = 'enterprise-auth-permissions';
  private readonly appRoles: AppRole[] = [
    'ADMIN',
    'EMPLOYEE',
    'MANAGER',
    'ROOM_MANAGER',
    'SECURITY_MANAGER',
    'DSN_DIRECTOR',
    'QUALITY_MANAGER',
  ];

  private readonly roleLabelsMap: Record<AppRole, string> = {
    ADMIN: 'Administrateur',
    EMPLOYEE: 'Employe',
    MANAGER: 'Chef hierarchique',
    ROOM_MANAGER: 'Responsable salle',
    SECURITY_MANAGER: 'Responsable securite',
    DSN_DIRECTOR: 'Directeur DSN',
    QUALITY_MANAGER: 'Responsable qualite'
  };

  private readonly defaultPermissionsByRole: Record<AppRole, string[]> = {
    ADMIN: [
      'VIEW_USERS_MODULE',
      'VIEW_EVENTS_MODULE',
      'VIEW_GED_MODULE',
      'VIEW_INTERVENTIONS_MODULE',
      'VIEW_REPORTS_MODULE',
      'CREATE_USER',
      'UPDATE_USER',
      'CREATE_EVENT',
      'VALIDATE_EVENT',
      'PUBLISH_DOCUMENT',
      'CHANGE_INTERVENTION_STATUS',
    ],
    EMPLOYEE: [
      'VIEW_EVENTS_MODULE',
      'VIEW_GED_MODULE',
      'VIEW_INTERVENTIONS_MODULE',
      'VIEW_REPORTS_MODULE',
      'CREATE_EVENT',
    ],
    MANAGER: [
      'VIEW_EVENTS_MODULE',
      'VIEW_GED_MODULE',
      'VIEW_INTERVENTIONS_MODULE',
      'VIEW_REPORTS_MODULE',
      'CREATE_EVENT',
      'VALIDATE_EVENT',
    ],
    ROOM_MANAGER: [
      'VIEW_INTERVENTIONS_MODULE',
      'VIEW_REPORTS_MODULE',
      'CHANGE_INTERVENTION_STATUS',
    ],
    SECURITY_MANAGER: [
      'VIEW_REPORTS_MODULE',
    ],
    DSN_DIRECTOR: [
      'VIEW_EVENTS_MODULE',
      'VIEW_REPORTS_MODULE',
      'VALIDATE_EVENT',
    ],
    QUALITY_MANAGER: [
      'VIEW_EVENTS_MODULE',
      'VIEW_GED_MODULE',
      'VIEW_REPORTS_MODULE',
      'CREATE_EVENT',
      'PUBLISH_DOCUMENT',
    ],
  };

  private currentUserSubject = new BehaviorSubject<AppUserProfile | null>(this.restoreUser());
  currentUser$ = this.currentUserSubject.asObservable();

  private currentRoleSubject = new BehaviorSubject<AppRole>(
    this.currentUserSubject.value?.role ?? 'EMPLOYEE'
  );
  currentRole$ = this.currentRoleSubject.asObservable();

  private currentPermissionsSubject = new BehaviorSubject<string[]>(this.restorePermissions());
  currentPermissions$ = this.currentPermissionsSubject.asObservable();

  constructor(private router: Router, private http: HttpClient) {
    this.refreshUserFromBackend();
    this.refreshPermissionsFromBackend();
  }

  get currentUser(): AppUserProfile | null {
    return this.currentUserSubject.value;
  }

  get currentRole(): AppRole {
    return this.currentRoleSubject.value;
  }

  get availableRoles(): AppRole[] {
    const current = this.currentUserSubject.value;
    if (!current) {
      return [];
    }

    const userRoles = current.roles?.length ? current.roles : [current.role];
    return Array.from(new Set(userRoles));
  }

  get roleLabels(): Record<AppRole, string> {
    return this.roleLabelsMap;
  }

  isAuthenticated(): boolean {
    return !!this.currentUserSubject.value;
  }

  signUp(firstName: string, lastName: string, email: string, password: string): Observable<void> {
    const payload: SignUpRequest = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      password: password.trim(),
    };

    if (!payload.firstName || !payload.lastName || !payload.email || !payload.password) {
      return throwError(() => new Error('Tous les champs obligatoires doivent etre renseignes.'));
    }

    return this.http.post(buildApiUrl('/api/v1/auth/register'), payload).pipe(
      map(() => undefined),
      catchError((error) => throwError(() => new Error(this.toSignUpErrorMessage(error)))),
    );
  }

  signIn(identifier: string, password: string): Observable<AppUserProfile> {
    const normalizedIdentifier = identifier.trim();
    const normalizedPassword = password.trim();

    if (!normalizedIdentifier || !normalizedPassword) {
      return throwError(() => new Error('Identifiant et mot de passe obligatoires.'));
    }

    return this.http.post<KeycloakTokenResponse>(
      buildApiUrl('/api/v1/auth/login'),
      {
        identifier: normalizedIdentifier,
        password: normalizedPassword,
      },
    ).pipe(
      map((response) => response.access_token?.trim() ?? ''),
      switchMap((accessToken) => {
        if (!accessToken) {
          return throwError(() => new Error('Token Keycloak introuvable dans la reponse.'));
        }

        this.persistBackendToken(accessToken);

        const fallbackUser = this.buildFallbackUserFromToken(accessToken, normalizedIdentifier);
        return this.syncWithBackendProfile(fallbackUser);
      }),
      catchError((error) => {
        this.clearBackendSession();
        return throwError(() => new Error(this.toSignInErrorMessage(error)));
      }),
    );
  }

  forgotPassword(email: string): Observable<string> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return throwError(() => new Error('Email obligatoire.'));
    }

    return this.http.post<PasswordRecoveryResponse>(
      buildApiUrl('/api/v1/password/forgot'),
      { email: normalizedEmail },
    ).pipe(
      map((response) => response.message?.trim() || 'If this email exists, a password reset link has been sent'),
      catchError((error) => throwError(() => new Error(this.toPasswordRecoveryErrorMessage(error)))),
    );
  }

  resetPassword(token: string, newPassword: string, confirmPassword: string): Observable<string> {
    const normalizedToken = token.trim();
    const normalizedNewPassword = newPassword.trim();
    const normalizedConfirmPassword = confirmPassword.trim();

    if (!normalizedToken || !normalizedNewPassword || !normalizedConfirmPassword) {
      return throwError(() => new Error('Token, mot de passe et confirmation sont obligatoires.'));
    }

    if (normalizedNewPassword.length < 8 || normalizedConfirmPassword.length < 8) {
      return throwError(() => new Error('Le mot de passe doit contenir au moins 8 caracteres.'));
    }

    if (normalizedNewPassword !== normalizedConfirmPassword) {
      return throwError(() => new Error('Les mots de passe ne correspondent pas.'));
    }

    return this.http.post<PasswordRecoveryResponse>(
      buildApiUrl('/api/v1/password/reset'),
      {
        token: normalizedToken,
        newPassword: normalizedNewPassword,
        confirmPassword: normalizedConfirmPassword,
      },
    ).pipe(
      map((response) => response.message?.trim() || 'Password has been reset successfully'),
      catchError((error) => throwError(() => new Error(this.toPasswordRecoveryErrorMessage(error)))),
    );
  }

  signOut(): void {
    this.clearBackendSession();
    this.router.navigate(['/signin']);
  }

  switchRole(role: AppRole): void {
    const current = this.currentUserSubject.value;
    if (!current) {
      return;
    }

    const allowedRoles = current.roles?.length ? current.roles : [current.role];
    if (!allowedRoles.includes(role)) {
      return;
    }

    const updatedUser: AppUserProfile = {
      ...current,
      role,
      roles: allowedRoles
    };

    this.persistUser(updatedUser);
    this.currentUserSubject.next(updatedUser);
    this.currentRoleSubject.next(role);
  }

  hasRole(...roles: AppRole[]): boolean {
    const current = this.currentUserSubject.value;
    if (!current) {
      return false;
    }

    return roles.some(role => current.roles.includes(role) || current.role === role);
  }

  canAccess(requiredRoles: AppRole[]): boolean {
    if (requiredRoles.length === 0) {
      return this.isAuthenticated();
    }

    return this.hasRole(...requiredRoles);
  }

  hasPermission(permissionCode: string): boolean {
    const normalizedCode = permissionCode.trim();
    if (!normalizedCode) {
      return true;
    }

    const effectivePermissions = this.getEffectivePermissions();
    return effectivePermissions.includes(normalizedCode);
  }

  hasAllPermissions(permissionCodes: string[] | undefined): boolean {
    if (!permissionCodes || permissionCodes.length === 0) {
      return true;
    }

    return permissionCodes.every((permissionCode) => this.hasPermission(permissionCode));
  }

  updateProfile(changes: Partial<Pick<AppUserProfile, 'firstName' | 'lastName' | 'email' | 'phone' | 'department'>>): void {
    const current = this.currentUserSubject.value;
    if (!current) {
      return;
    }

    const updated: AppUserProfile = {
      ...current,
      ...changes,
      email: (changes.email ?? current.email).trim()
    };

    this.persistUser(updated);
    this.currentUserSubject.next(updated);
  }

  private persistUser(user: AppUserProfile): void {
    localStorage.setItem(this.storageKey, JSON.stringify(user));
  }

  private persistBackendToken(token: string): void {
    localStorage.setItem('backend_access_token', token);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('access_token');
  }

  private clearBackendSession(): void {
    this.currentUserSubject.next(null);
    this.currentRoleSubject.next('EMPLOYEE');
    this.currentPermissionsSubject.next([]);
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.permissionStorageKey);
    localStorage.removeItem('backend_access_token');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('access_token');
  }

  private syncWithBackendProfile(fallbackUser: AppUserProfile): Observable<AppUserProfile> {
    if (!this.readBackendToken()) {
      const fallbackWithPermissions = this.attachRoleDefaultPermissions(fallbackUser);
      this.persistUser(fallbackWithPermissions);
      this.currentUserSubject.next(fallbackWithPermissions);
      this.currentRoleSubject.next(fallbackWithPermissions.role);
      this.persistPermissions(fallbackWithPermissions.permissions ?? []);
      this.currentPermissionsSubject.next(fallbackWithPermissions.permissions ?? []);
      return of(fallbackWithPermissions);
    }

    return this.http.get<BackendProfileResponse>(buildApiUrl('/api/v1/me')).pipe(
      map((response) => this.mapBackendProfile(response, fallbackUser)),
      tap((profile) => {
        const profileWithDefaults = this.attachRoleDefaultPermissions(profile);
        this.persistUser(profileWithDefaults);
        this.currentUserSubject.next(profileWithDefaults);
        this.currentRoleSubject.next(profileWithDefaults.role);
        this.persistPermissions(profileWithDefaults.permissions ?? []);
        this.currentPermissionsSubject.next(profileWithDefaults.permissions ?? []);
        this.refreshPermissionsFromBackend();
      }),
      catchError(() => {
        const fallbackWithPermissions = this.attachRoleDefaultPermissions(fallbackUser);
        this.persistUser(fallbackWithPermissions);
        this.currentUserSubject.next(fallbackWithPermissions);
        this.currentRoleSubject.next(fallbackWithPermissions.role);
        this.persistPermissions(fallbackWithPermissions.permissions ?? []);
        this.currentPermissionsSubject.next(fallbackWithPermissions.permissions ?? []);
        return of(fallbackWithPermissions);
      }),
    );
  }

  private mapBackendProfile(
    response: BackendProfileResponse,
    fallbackUser: AppUserProfile,
  ): AppUserProfile {
    const backendRoles = toFrontendRoles(response.roles ?? []);
    const roles = backendRoles.length > 0 ? backendRoles : fallbackUser.roles;
    const role = roles[0] ?? fallbackUser.role;

    return {
      id: response.id || fallbackUser.id,
      username: response.username || fallbackUser.username,
      firstName: response.firstName || fallbackUser.firstName,
      lastName: response.lastName || fallbackUser.lastName,
      email: response.email || fallbackUser.email,
      phone: response.phone || fallbackUser.phone,
      department: response.department?.name || fallbackUser.department,
      roles,
      role,
    };
  }

  private buildFallbackUserFromToken(token: string, identifier: string): AppUserProfile {
    const payload = this.decodeJwtPayload(token);
    const username = payload?.preferred_username?.trim() || identifier;
    const roles = toFrontendRoles(payload?.realm_access?.roles ?? []);
    const firstName = payload?.given_name?.trim() || this.extractFirstName(username);
    const lastName = payload?.family_name?.trim() || '';
    const email = payload?.email?.trim() || this.extractEmail(identifier);

    return {
      id: payload?.sub || `user-${Date.now()}`,
      username,
      firstName,
      lastName,
      email,
      roles: roles.length > 0 ? roles : ['EMPLOYEE'],
      role: roles[0] ?? 'EMPLOYEE',
    };
  }

  private decodeJwtPayload(token: string): KeycloakJwtPayload | null {
    const tokenParts = token.split('.');
    if (tokenParts.length < 2) {
      return null;
    }

    let payload = tokenParts[1].replace(/-/g, '+').replace(/_/g, '/');
    const remainder = payload.length % 4;
    if (remainder === 2) {
      payload += '==';
    } else if (remainder === 3) {
      payload += '=';
    } else if (remainder === 1) {
      return null;
    }

    try {
      return JSON.parse(atob(payload)) as KeycloakJwtPayload;
    } catch {
      return null;
    }
  }

  private extractFirstName(identifier: string): string {
    const safeIdentifier = identifier.trim();
    if (!safeIdentifier) {
      return 'Utilisateur';
    }

    const firstToken = safeIdentifier
      .replace('@', '.')
      .split(/[.\-_]/)
      .map((part) => part.trim())
      .find((part) => !!part);

    if (!firstToken) {
      return 'Utilisateur';
    }

    return firstToken.charAt(0).toUpperCase() + firstToken.slice(1);
  }

  private extractEmail(identifier: string): string {
    const normalized = identifier.trim();
    if (normalized.includes('@')) {
      return normalized;
    }

    return `${normalized}@cnstn.local`;
  }

  private toSignInErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Connexion au backend impossible. Verifiez que les services sont demarres.';
      }

      if (error.status === 400 || error.status === 401) {
        return 'Identifiant ou mot de passe invalide.';
      }

      const detail = typeof error.error === 'object' && typeof error.error?.detail === 'string'
        ? error.error.detail
        : '';

      if (detail) {
        return detail;
      }

      if (typeof error.error === 'object' && typeof error.error?.error_description === 'string') {
        return error.error.error_description;
      }
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'Echec de connexion.';
  }

  private toSignUpErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Backend inaccessible. Verifiez que les services sont demarres.';
      }

      const detail = typeof error.error === 'object' && typeof error.error?.detail === 'string'
        ? error.error.detail
        : '';

      if (error.status === 409) {
        return detail || 'Cet email existe deja.';
      }

      if (error.status === 400) {
        return detail || 'Donnees invalides. Verifiez les champs du formulaire.';
      }

      if (error.status === 502) {
        return 'Erreur de synchronisation Keycloak. Reessayez dans quelques secondes.';
      }

      if (detail) {
        return detail;
      }
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'Echec de creation du compte.';
  }

  private toPasswordRecoveryErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Backend inaccessible. Verifiez que les services sont demarres.';
      }

      const detail = typeof error.error === 'object' && typeof error.error?.detail === 'string'
        ? error.error.detail
        : '';

      if (error.status === 400) {
        return detail || 'Donnees invalides. Verifiez les champs saisis.';
      }

      if (error.status === 404) {
        return detail || 'Lien de reinitialisation invalide.';
      }

      if (error.status === 502) {
        return 'Service externe indisponible. Reessayez dans quelques secondes.';
      }

      if (detail) {
        return detail;
      }
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'Operation impossible pour le moment.';
  }

  private refreshPermissionsFromBackend(): void {
    const restoredUser = this.currentUserSubject.value;
    if (!restoredUser || !this.readBackendToken()) {
      return;
    }

    this.http.get<BackendMyPermissionsResponse>(buildApiUrl('/api/v1/me/permissions')).pipe(
      map((response) => {
        const effectivePermissions = Array.from(new Set(response.effectivePermissions ?? []));
        return {
          customized: !!response.customized,
          effectivePermissions,
        };
      }),
      catchError(() => of({
        customized: false,
        effectivePermissions: this.resolveDefaultPermissionsForRoles(restoredUser.roles),
      })),
    ).subscribe((permissions) => {
      const current = this.currentUserSubject.value;
      if (!current) {
        return;
      }

      const updatedUser: AppUserProfile = {
        ...current,
        permissionsCustomized: permissions.customized,
        permissions: permissions.effectivePermissions,
      };

      this.persistUser(updatedUser);
      this.persistPermissions(permissions.effectivePermissions);
      this.currentUserSubject.next(updatedUser);
      this.currentPermissionsSubject.next(permissions.effectivePermissions);
    });
  }

  private getEffectivePermissions(): string[] {
    const explicitPermissions = this.currentPermissionsSubject.value;
    if (explicitPermissions.length > 0) {
      return explicitPermissions;
    }

    const current = this.currentUserSubject.value;
    if (!current) {
      return [];
    }

    return this.resolveDefaultPermissionsForRoles(current.roles);
  }

  private attachRoleDefaultPermissions(user: AppUserProfile): AppUserProfile {
    const defaults = this.resolveDefaultPermissionsForRoles(user.roles);
    return {
      ...user,
      permissionsCustomized: false,
      permissions: defaults,
    };
  }

  private resolveDefaultPermissionsForRoles(roles: AppRole[]): string[] {
    const normalizedRoles = Array.from(new Set(roles));
    const merged = new Set<string>();

    normalizedRoles.forEach((role) => {
      (this.defaultPermissionsByRole[role] ?? []).forEach((permissionCode) => merged.add(permissionCode));
    });

    if (normalizedRoles.includes('QUALITY_MANAGER')) {
      (this.defaultPermissionsByRole.EMPLOYEE ?? []).forEach((permissionCode) => merged.add(permissionCode));
    }

    return Array.from(merged);
  }

  private persistPermissions(permissionCodes: string[]): void {
    localStorage.setItem(this.permissionStorageKey, JSON.stringify(permissionCodes));
  }

  private restorePermissions(): string[] {
    const raw = localStorage.getItem(this.permissionStorageKey);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as string[];
      return Array.isArray(parsed) ? Array.from(new Set(parsed)) : [];
    } catch {
      return [];
    }
  }

  private readBackendToken(): string {
    return localStorage.getItem('backend_access_token')?.trim()
      || localStorage.getItem('auth_token')?.trim()
      || localStorage.getItem('access_token')?.trim()
      || '';
  }

  private refreshUserFromBackend(): void {
    const restoredUser = this.currentUserSubject.value;
    if (!restoredUser || !this.readBackendToken()) {
      return;
    }

    this.syncWithBackendProfile(restoredUser).subscribe();
  }

  private extractRolesFromStoredToken(): AppRole[] {
    const token = this.readBackendToken();
    if (!token) {
      return [];
    }

    const payload = this.decodeJwtPayload(token);
    return toFrontendRoles(payload?.realm_access?.roles ?? []);
  }

  private restoreUser(): AppUserProfile | null {
    if (!this.readBackendToken()) {
      return null;
    }

    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as AppUserProfile;
      if (!parsed?.email || !parsed?.role) {
        return null;
      }

      const persistedRoles = Array.isArray(parsed.roles) ? parsed.roles : [];
      const normalizedStoredRoles = Array.from(new Set([parsed.role, ...persistedRoles]))
        .filter((role): role is AppRole => this.appRoles.includes(role as AppRole));
      const tokenRoles = this.extractRolesFromStoredToken();
      const normalizedRoles = tokenRoles.length > 0 ? tokenRoles : normalizedStoredRoles;
      const role = normalizedRoles.includes(parsed.role) ? parsed.role : normalizedRoles[0];

      if (!role) {
        return null;
      }

      return {
        ...parsed,
        role,
        roles: normalizedRoles,
        permissionsCustomized: !!parsed.permissionsCustomized,
        permissions: Array.isArray(parsed.permissions)
          ? Array.from(new Set(parsed.permissions))
          : this.resolveDefaultPermissionsForRoles(normalizedRoles),
      };
    } catch {
      return null;
    }
  }
}
