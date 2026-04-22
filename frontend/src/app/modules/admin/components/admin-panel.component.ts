import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { User, AuditLog, SystemConfig, UserStatistics, Department, PermissionDefinition, UserPermissionMatrix } from '../../../core/models';
import { Option, SelectComponent } from '../../../shared/components/form/select/select.component';

interface UserFormModel {
  id: string | null;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  department: string;
  phone: string;
  roles: string[];
  isActive: boolean;
}

interface DepartmentFormModel {
  id: string | null;
  name: string;
  code: string;
  description: string;
  managerName: string;
  isActive: boolean;
}

interface PermissionGroup {
  module: string;
  permissions: PermissionDefinition[];
}

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectComponent],
  template: `
    <div class="container mx-auto px-4 py-6">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-gray-800 mb-2">Administration Panel</h1>
        <p class="text-gray-600">User management, role assignment and enterprise services setup</p>
      </div>

      <div *ngIf="!hasAdminAccess()" class="rounded-2xl border border-warning-300 bg-warning-50 p-6 text-warning-700">
        <h2 class="text-lg font-semibold mb-2">Access restricted</h2>
        <p>
          This module is available only for administrators.
          Switch role to <strong>Administrateur</strong> from the user dropdown to manage users and services.
        </p>
      </div>

      <ng-container *ngIf="hasAdminAccess()">
        <div class="flex gap-4 mb-6 border-b overflow-x-auto">
          <button
            *ngFor="let tab of tabs"
            (click)="activeTab = tab"
            [ngClass]="{
              'border-b-2 border-brand-500 font-bold text-brand-600': activeTab === tab
            }"
            class="px-4 py-2 text-gray-600 hover:text-gray-900 transition whitespace-nowrap"
          >
            {{ tab }}
          </button>
        </div>

        <div *ngIf="activeTab === 'Users'" class="space-y-4">
          <button
            (click)="startCreateUser()"
            class="px-6 py-3 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition font-semibold"
          >
            + Add New User
          </button>

          <div *ngIf="showUserForm" class="bg-white rounded-lg shadow-md p-6">
            <h2 class="text-xl font-bold mb-4">{{ userForm.id ? 'Edit User' : 'Create New User' }}</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                [(ngModel)]="userForm.firstName"
                placeholder="First Name"
                class="px-4 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="text"
                [(ngModel)]="userForm.lastName"
                placeholder="Last Name"
                class="px-4 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="email"
                [(ngModel)]="userForm.email"
                placeholder="Email"
                class="px-4 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="text"
                [(ngModel)]="userForm.username"
                placeholder="Username"
                class="px-4 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="text"
                [(ngModel)]="userForm.department"
                placeholder="Service/Department"
                class="px-4 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="text"
                [(ngModel)]="userForm.phone"
                placeholder="Phone"
                class="px-4 py-2 border border-gray-300 rounded-lg"
              />
              <div class="md:col-span-2">
                <label class="text-sm font-semibold text-gray-700 mb-2 block">Assigned Roles</label>
                <app-select
                  [(ngModel)]="userForm.roles"
                  [options]="roleOptionItems"
                  [multiple]="true"
                  [closeOnSelect]="false"
                  placeholder="Select roles"
                  className="min-h-[120px]"
                ></app-select>
              </div>
            </div>

            <div *ngIf="formError" class="mt-4 rounded-lg border border-error-300 bg-error-50 px-4 py-2 text-sm text-error-600">
              {{ formError }}
            </div>

            <div class="mt-4 flex gap-2">
              <button
                (click)="saveUser()"
                class="px-6 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition"
              >
                {{ userForm.id ? 'Update User' : 'Create User' }}
              </button>
              <button
                (click)="cancelUserEdit()"
                class="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
              >
                Cancel
              </button>
            </div>
          </div>

          <div class="bg-white rounded-lg shadow-md overflow-hidden">
            <table class="w-full">
              <thead class="bg-gray-100 border-b">
                <tr>
                  <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                  <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                  <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Department</th>
                  <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Roles</th>
                  <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let user of users" class="border-b hover:bg-gray-50">
                  <td class="px-6 py-4">{{ user.firstName }} {{ user.lastName }}</td>
                  <td class="px-6 py-4 text-sm text-gray-600">{{ user.email }}</td>
                  <td class="px-6 py-4 text-sm text-gray-600">{{ user.department || '-' }}</td>
                  <td class="px-6 py-4 text-sm">
                    <div class="flex flex-wrap gap-1">
                      <span *ngFor="let role of user.roles" class="px-2 py-1 bg-brand-100 text-brand-800 rounded text-xs">
                        {{ role }}
                      </span>
                    </div>
                  </td>
                  <td class="px-6 py-4">
                    <span
                      [ngClass]="{
                        'bg-green-100 text-green-800': user.isActive,
                        'bg-gray-100 text-gray-800': !user.isActive
                      }"
                      class="px-3 py-1 rounded-full text-xs font-semibold"
                    >
                      {{ user.isActive ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-sm">
                    <button (click)="startEditUser(user)" class="text-brand-500 hover:text-brand-700 mr-3">Edit</button>
                    <button (click)="toggleUserStatus(user)" class="text-indigo-500 hover:text-indigo-700 mr-3">
                      {{ user.isActive ? 'Deactivate' : 'Activate' }}
                    </button>
                    <button (click)="deleteUser(user.id)" class="text-red-500 hover:text-red-700">Delete</button>
                  </td>
                </tr>
                <tr *ngIf="users.length === 0">
                  <td colspan="6" class="px-6 py-8 text-center text-gray-500">No users found.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div *ngIf="activeTab === 'Services'" class="space-y-4">
          <button
            (click)="startCreateDepartment()"
            class="px-6 py-3 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition font-semibold"
          >
            + Add Service / Department
          </button>

          <div *ngIf="showDepartmentForm" class="bg-white rounded-lg shadow-md p-6">
            <h2 class="text-xl font-bold mb-4">{{ departmentForm.id ? 'Edit Service' : 'Create Service' }}</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                [(ngModel)]="departmentForm.name"
                placeholder="Service Name"
                class="px-4 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="text"
                [(ngModel)]="departmentForm.code"
                placeholder="Code (e.g. DSN)"
                class="px-4 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="text"
                [(ngModel)]="departmentForm.managerName"
                placeholder="Manager Name"
                class="px-4 py-2 border border-gray-300 rounded-lg"
              />
              <app-select
                [(ngModel)]="departmentForm.isActive"
                [options]="activeStatusOptions"
                placeholder="Status"
              ></app-select>
              <textarea
                [(ngModel)]="departmentForm.description"
                rows="3"
                placeholder="Description"
                class="md:col-span-2 px-4 py-2 border border-gray-300 rounded-lg"
              ></textarea>
            </div>

            <div *ngIf="departmentFormError" class="mt-4 rounded-lg border border-error-300 bg-error-50 px-4 py-2 text-sm text-error-600">
              {{ departmentFormError }}
            </div>

            <div class="mt-4 flex gap-2">
              <button
                (click)="saveDepartment()"
                class="px-6 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition"
              >
                {{ departmentForm.id ? 'Update Service' : 'Create Service' }}
              </button>
              <button
                (click)="cancelDepartmentEdit()"
                class="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
              >
                Cancel
              </button>
            </div>
          </div>

          <div class="bg-white rounded-lg shadow-md overflow-hidden">
            <table class="w-full">
              <thead class="bg-gray-100 border-b">
                <tr>
                  <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                  <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Code</th>
                  <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Manager</th>
                  <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let department of departments" class="border-b hover:bg-gray-50">
                  <td class="px-6 py-4">
                    <div class="font-medium text-gray-900">{{ department.name }}</div>
                    <div class="text-xs text-gray-500">{{ department.description || '-' }}</div>
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-600">{{ department.code }}</td>
                  <td class="px-6 py-4 text-sm text-gray-600">{{ department.managerName || '-' }}</td>
                  <td class="px-6 py-4">
                    <span
                      [ngClass]="department.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'"
                      class="px-3 py-1 rounded-full text-xs font-semibold"
                    >
                      {{ department.isActive ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-sm">
                    <button (click)="startEditDepartment(department)" class="text-brand-500 hover:text-brand-700 mr-3">Edit</button>
                    <button (click)="deleteDepartment(department.id)" class="text-red-500 hover:text-red-700">Delete</button>
                  </td>
                </tr>
                <tr *ngIf="departments.length === 0">
                  <td colspan="5" class="px-6 py-8 text-center text-gray-500">No services configured.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div *ngIf="activeTab === 'System Config'" class="bg-white rounded-lg shadow-md p-6">
          <h2 class="text-xl font-bold mb-4">System Configuration</h2>
          <div class="space-y-4">
            <div *ngFor="let config of systemConfigs" class="border-b pb-4">
              <div class="flex justify-between items-start mb-2 gap-4">
                <div>
                  <h3 class="font-semibold text-gray-900">{{ config.key }}</h3>
                  <p class="text-sm text-gray-600">{{ config.description }}</p>
                </div>
                <span
                  [ngClass]="config.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                  class="px-3 py-1 rounded-full text-xs font-semibold"
                >
                  {{ config.isActive ? 'Active' : 'Inactive' }}
                </span>
              </div>
              <div class="flex gap-2">
                <input
                  type="text"
                  [(ngModel)]="config.value"
                  class="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                />
                <button
                  (click)="updateConfig(config)"
                  class="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>

        <div *ngIf="activeTab === 'Audit Logs'" class="bg-white rounded-lg shadow-md overflow-hidden">
          <div class="p-4 border-b">
            <h2 class="text-xl font-bold">Audit Logs</h2>
          </div>
          <table class="w-full">
            <thead class="bg-gray-100 border-b">
              <tr>
                <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">User</th>
                <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Action</th>
                <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Entity</th>
                <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let log of auditLogs" class="border-b hover:bg-gray-50">
                <td class="px-6 py-4 text-sm text-gray-900">{{ log.userName }}</td>
                <td class="px-6 py-4 text-sm font-medium text-gray-900">{{ log.action }}</td>
                <td class="px-6 py-4 text-sm text-gray-600">{{ log.entityType }}</td>
                <td class="px-6 py-4">
                  <span
                    [ngClass]="{
                      'bg-green-100 text-green-800': log.status === 'SUCCESS',
                      'bg-red-100 text-red-800': log.status === 'FAILURE'
                    }"
                    class="px-3 py-1 rounded-full text-xs font-semibold"
                  >
                    {{ log.status }}
                  </span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-600">{{ log.timestamp | date:'short' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div *ngIf="activeTab === 'Permissions'" class="space-y-4">
          <div class="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 class="text-xl font-bold text-gray-900">Gestion des permissions</h2>
            <p class="mt-1 text-sm text-gray-600">
              Selectionnez un utilisateur, puis activez/desactivez chaque permission par clic.
            </p>
          </div>

          <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <section class="rounded-2xl border border-gray-200 bg-white p-4 xl:col-span-1">
              <h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Utilisateurs</h3>

              <div class="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                <button
                  *ngFor="let user of users"
                  type="button"
                  (click)="selectPermissionsUser(user.id)"
                  class="w-full rounded-xl border px-3 py-3 text-left transition"
                  [ngClass]="selectedPermissionsUserId === user.id
                    ? 'border-brand-400 bg-brand-50'
                    : 'border-gray-200 bg-white hover:border-brand-300 hover:bg-gray-50'"
                >
                  <p class="text-sm font-semibold text-gray-900">{{ user.firstName }} {{ user.lastName }}</p>
                  <p class="text-xs text-gray-500">{{ user.email }}</p>
                </button>
              </div>
            </section>

            <section class="rounded-2xl border border-gray-200 bg-white p-4 xl:col-span-2">
              <div *ngIf="!selectedPermissionsUserId" class="rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
                Selectionnez un utilisateur pour modifier ses permissions.
              </div>

              <ng-container *ngIf="selectedPermissionsUserId">
                <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p class="text-sm text-gray-500">Utilisateur selectionne</p>
                    <p class="text-base font-semibold text-gray-900">{{ selectedPermissionsUserLabel }}</p>
                    <p class="text-xs text-gray-500">
                      Mode: {{ selectedUserPermissions?.customized ? 'Personnalise' : 'Par defaut (roles)' }}
                    </p>
                  </div>

                  <button
                    type="button"
                    (click)="resetSelectedUserPermissions()"
                    [disabled]="isSavingPermissions"
                    class="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Reinitialiser par roles
                  </button>
                </div>

                <div *ngIf="permissionsFeedback"
                  class="mb-4 rounded-lg border px-3 py-2 text-sm"
                  [ngClass]="permissionsFeedbackTone === 'success'
                    ? 'border-success-200 bg-success-50 text-success-700'
                    : 'border-error-200 bg-error-50 text-error-700'"
                >
                  {{ permissionsFeedback }}
                </div>

                <div class="space-y-4" *ngIf="permissionGroups.length > 0; else noPermissionsTemplate">
                  <article *ngFor="let group of permissionGroups" class="rounded-xl border border-gray-200">
                    <div class="border-b border-gray-200 bg-gray-50 px-4 py-2">
                      <h4 class="text-sm font-semibold text-gray-700">{{ group.module }}</h4>
                    </div>

                    <div class="divide-y divide-gray-100">
                      <label
                        *ngFor="let permission of group.permissions"
                        class="flex cursor-pointer items-start justify-between gap-3 px-4 py-3 hover:bg-gray-50"
                      >
                        <div>
                          <p class="text-sm font-semibold text-gray-900">{{ permission.label }}</p>
                          <p class="text-xs text-gray-500">{{ permission.description }}</p>
                          <p class="mt-1 text-[11px] font-mono text-gray-400">{{ permission.code }}</p>
                        </div>

                        <input
                          type="checkbox"
                          class="mt-1 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                          [checked]="isPermissionChecked(permission.code)"
                          [disabled]="isSavingPermissions"
                          (change)="togglePermission(permission.code, $event)"
                        />
                      </label>
                    </div>
                  </article>
                </div>

                <ng-template #noPermissionsTemplate>
                  <div class="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                    Aucune permission disponible.
                  </div>
                </ng-template>
              </ng-container>
            </section>
          </div>
        </div>

        <div *ngIf="activeTab === 'Statistics'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div class="bg-white rounded-lg shadow-md p-6">
            <h3 class="text-gray-600 text-sm font-semibold mb-2">Total Users</h3>
            <p class="text-3xl font-bold text-gray-900">{{ userStats?.totalUsers || 0 }}</p>
          </div>
          <div class="bg-white rounded-lg shadow-md p-6">
            <h3 class="text-gray-600 text-sm font-semibold mb-2">Active Users</h3>
            <p class="text-3xl font-bold text-green-600">{{ userStats?.activeUsers || 0 }}</p>
          </div>
          <div class="bg-white rounded-lg shadow-md p-6">
            <h3 class="text-gray-600 text-sm font-semibold mb-2">Inactive Users</h3>
            <p class="text-3xl font-bold text-red-600">{{ userStats?.inactiveUsers || 0 }}</p>
          </div>
          <div class="bg-white rounded-lg shadow-md p-6">
            <h3 class="text-gray-600 text-sm font-semibold mb-2">New This Month</h3>
            <p class="text-3xl font-bold text-blue-600">{{ userStats?.newUsersThisMonth || 0 }}</p>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: []
})
export class AdminPanelComponent implements OnInit {
  tabs = ['Users', 'Services', 'Permissions', 'Statistics'];
  activeTab = 'Users';

  users: User[] = [];
  departments: Department[] = [];
  systemConfigs: SystemConfig[] = [];
  auditLogs: AuditLog[] = [];
  userStats: UserStatistics | null = null;
  permissionCatalog: PermissionDefinition[] = [];
  permissionGroups: PermissionGroup[] = [];
  selectedPermissionsUserId: string | null = null;
  selectedUserPermissions: UserPermissionMatrix | null = null;
  selectedEffectivePermissionCodes = new Set<string>();
  isSavingPermissions = false;
  permissionsFeedback = '';
  permissionsFeedbackTone: 'success' | 'error' = 'success';

  showUserForm = false;
  formError = '';

  showDepartmentForm = false;
  departmentFormError = '';

  readonly roleOptions: string[] = [
    'ADMIN',
    'EMPLOYEE',
    'MANAGER',
    'ROOM_MANAGER',
    'SECURITY_MANAGER',
    'DSN_DIRECTOR',
    'QUALITY_MANAGER'
  ];

  readonly activeStatusOptions: Option[] = [
    { value: true, label: 'Active' },
    { value: false, label: 'Inactive' },
  ];

  get roleOptionItems(): Option[] {
    return this.roleOptions.map((role) => ({
      value: role,
      label: role,
    }));
  }

  userForm: UserFormModel = this.getEmptyUserForm();
  departmentForm: DepartmentFormModel = this.getEmptyDepartmentForm();

  constructor(private adminService: AdminService, private authService: AuthService) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadDepartments();
    this.loadStatistics();
    this.loadPermissionCatalog();
  }

  hasAdminAccess(): boolean {
    return this.authService.hasRole('ADMIN');
  }

  loadUsers(): void {
    this.adminService.getUsers().subscribe(users => {
      this.users = users;
    });
  }

  loadDepartments(): void {
    this.adminService.getDepartments().subscribe(departments => {
      this.departments = departments;
    });
  }

  loadSystemConfig(): void {
    this.adminService.getSystemConfig().subscribe(configs => {
      this.systemConfigs = configs;
    });
  }

  loadAuditLogs(): void {
    this.adminService.getAuditLogs().subscribe(logs => {
      this.auditLogs = logs.slice(0, 30);
    });
  }

  loadStatistics(): void {
    this.adminService.getUserStatistics().subscribe(stats => {
      this.userStats = stats;
    });
  }

  get selectedPermissionsUserLabel(): string {
    if (!this.selectedPermissionsUserId) {
      return '';
    }

    const user = this.users.find((item) => item.id === this.selectedPermissionsUserId);
    if (!user) {
      return '';
    }

    return `${user.firstName} ${user.lastName}`.trim() || user.email;
  }

  loadPermissionCatalog(): void {
    this.adminService.getPermissionCatalog().subscribe({
      next: (permissions) => {
        this.permissionCatalog = permissions;
        this.permissionGroups = this.groupPermissionsByModule(permissions);
      },
      error: (error) => {
        this.permissionsFeedbackTone = 'error';
        this.permissionsFeedback = error instanceof Error ? error.message : 'Chargement des permissions impossible.';
      }
    });
  }

  selectPermissionsUser(userId: string): void {
    this.selectedPermissionsUserId = userId;
    this.permissionsFeedback = '';
    this.selectedUserPermissions = null;
    this.selectedEffectivePermissionCodes = new Set<string>();

    this.adminService.getUserPermissionMatrix(userId).subscribe({
      next: (matrix) => {
        this.selectedUserPermissions = matrix;
        this.selectedEffectivePermissionCodes = new Set(matrix.effectivePermissions);
      },
      error: (error) => {
        this.permissionsFeedbackTone = 'error';
        this.permissionsFeedback = error instanceof Error ? error.message : 'Chargement des permissions utilisateur impossible.';
      }
    });
  }

  isPermissionChecked(permissionCode: string): boolean {
    return this.selectedEffectivePermissionCodes.has(permissionCode);
  }

  togglePermission(permissionCode: string, event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const shouldEnable = !!input?.checked;

    if (!this.selectedPermissionsUserId) {
      return;
    }

    if (shouldEnable) {
      this.selectedEffectivePermissionCodes.add(permissionCode);
    } else {
      this.selectedEffectivePermissionCodes.delete(permissionCode);
    }

    this.isSavingPermissions = true;
    this.permissionsFeedback = '';

    const payload = Array.from(this.selectedEffectivePermissionCodes);
    this.adminService.updateUserPermissions(this.selectedPermissionsUserId, payload).subscribe({
      next: (matrix) => {
        this.isSavingPermissions = false;
        this.selectedUserPermissions = matrix;
        this.selectedEffectivePermissionCodes = new Set(matrix.effectivePermissions);
        this.permissionsFeedbackTone = 'success';
        this.permissionsFeedback = 'Permissions utilisateur mises a jour.';
      },
      error: (error) => {
        this.isSavingPermissions = false;
        if (shouldEnable) {
          this.selectedEffectivePermissionCodes.delete(permissionCode);
        } else {
          this.selectedEffectivePermissionCodes.add(permissionCode);
        }
        this.permissionsFeedbackTone = 'error';
        this.permissionsFeedback = error instanceof Error ? error.message : 'Mise a jour des permissions impossible.';
      }
    });
  }

  resetSelectedUserPermissions(): void {
    if (!this.selectedPermissionsUserId) {
      return;
    }

    this.isSavingPermissions = true;
    this.permissionsFeedback = '';

    this.adminService.resetUserPermissions(this.selectedPermissionsUserId).subscribe({
      next: (matrix) => {
        this.isSavingPermissions = false;
        this.selectedUserPermissions = matrix;
        this.selectedEffectivePermissionCodes = new Set(matrix.effectivePermissions);
        this.permissionsFeedbackTone = 'success';
        this.permissionsFeedback = 'Permissions reinitialisees selon les roles.';
      },
      error: (error) => {
        this.isSavingPermissions = false;
        this.permissionsFeedbackTone = 'error';
        this.permissionsFeedback = error instanceof Error ? error.message : 'Reinitialisation des permissions impossible.';
      }
    });
  }

  startCreateUser(): void {
    this.formError = '';
    this.userForm = this.getEmptyUserForm();
    this.showUserForm = true;
  }

  startEditUser(user: User): void {
    this.formError = '';
    this.userForm = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      username: user.username,
      department: user.department || '',
      phone: user.phone || '',
      roles: [...user.roles],
      isActive: user.isActive
    };
    this.showUserForm = true;
  }

  cancelUserEdit(): void {
    this.showUserForm = false;
    this.userForm = this.getEmptyUserForm();
    this.formError = '';
  }

  saveUser(): void {
    if (!this.userForm.firstName.trim() || !this.userForm.email.trim() || this.userForm.roles.length === 0) {
      this.formError = 'First name, email and at least one role are required.';
      return;
    }

    this.formError = '';

    if (this.userForm.id) {
      const userId = this.userForm.id;
      this.adminService.updateUser(userId, {
        firstName: this.userForm.firstName.trim(),
        lastName: this.userForm.lastName.trim(),
        email: this.userForm.email.trim(),
        username: this.userForm.username.trim() || this.userForm.email.split('@')[0],
        department: this.userForm.department.trim(),
        phone: this.userForm.phone.trim(),
        roles: [...this.userForm.roles],
        isActive: this.userForm.isActive
      }).subscribe(() => {
        this.loadUsers();
        this.cancelUserEdit();
      });
      return;
    }

    this.adminService.createUser({
      firstName: this.userForm.firstName.trim(),
      lastName: this.userForm.lastName.trim(),
      email: this.userForm.email.trim(),
      username: this.userForm.username.trim() || this.userForm.email.split('@')[0],
      department: this.userForm.department.trim(),
      phone: this.userForm.phone.trim(),
      roles: [...this.userForm.roles],
      isActive: this.userForm.isActive
    }).subscribe(() => {
      this.loadUsers();
      this.loadStatistics();
      this.cancelUserEdit();
    });
  }

  toggleUserStatus(user: User): void {
    this.adminService.updateUser(user.id, { isActive: !user.isActive }).subscribe(() => {
      this.loadUsers();
      this.loadStatistics();
    });
  }

  deleteUser(id: string): void {
    if (!confirm('Delete this user?')) {
      return;
    }

    this.adminService.deleteUser(id).subscribe(() => {
      this.loadUsers();
      this.loadStatistics();
    });
  }

  startCreateDepartment(): void {
    this.departmentFormError = '';
    this.departmentForm = this.getEmptyDepartmentForm();
    this.showDepartmentForm = true;
  }

  startEditDepartment(department: Department): void {
    this.departmentFormError = '';
    this.departmentForm = {
      id: department.id,
      name: department.name,
      code: department.code,
      description: department.description || '',
      managerName: department.managerName || '',
      isActive: department.isActive
    };
    this.showDepartmentForm = true;
  }

  cancelDepartmentEdit(): void {
    this.showDepartmentForm = false;
    this.departmentForm = this.getEmptyDepartmentForm();
    this.departmentFormError = '';
  }

  saveDepartment(): void {
    if (!this.departmentForm.name.trim() || !this.departmentForm.code.trim()) {
      this.departmentFormError = 'Service name and code are required.';
      return;
    }

    this.departmentFormError = '';

    if (this.departmentForm.id) {
      this.adminService.updateDepartment(this.departmentForm.id, {
        name: this.departmentForm.name.trim(),
        code: this.departmentForm.code.trim().toUpperCase(),
        description: this.departmentForm.description.trim(),
        managerName: this.departmentForm.managerName.trim(),
        isActive: this.departmentForm.isActive
      }).subscribe(() => {
        this.loadDepartments();
        this.cancelDepartmentEdit();
      });
      return;
    }

    this.adminService.createDepartment({
      name: this.departmentForm.name.trim(),
      code: this.departmentForm.code.trim().toUpperCase(),
      description: this.departmentForm.description.trim(),
      managerName: this.departmentForm.managerName.trim(),
      isActive: this.departmentForm.isActive
    }).subscribe(() => {
      this.loadDepartments();
      this.cancelDepartmentEdit();
    });
  }

  deleteDepartment(id: string): void {
    if (!confirm('Delete this service/department?')) {
      return;
    }

    this.adminService.deleteDepartment(id).subscribe(() => {
      this.loadDepartments();
    });
  }

  updateConfig(config: SystemConfig): void {
    this.adminService.updateSystemConfig(config.id, config).subscribe();
  }

  private groupPermissionsByModule(permissions: PermissionDefinition[]): PermissionGroup[] {
    const grouped = new Map<string, PermissionDefinition[]>();

    permissions.forEach((permission) => {
      const key = permission.module || 'GENERAL';
      const existing = grouped.get(key) ?? [];
      existing.push(permission);
      grouped.set(key, existing);
    });

    return Array.from(grouped.entries())
      .sort(([moduleA], [moduleB]) => moduleA.localeCompare(moduleB, 'fr', { sensitivity: 'base' }))
      .map(([module, modulePermissions]) => ({
        module,
        permissions: [...modulePermissions].sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' })),
      }));
  }

  private getEmptyUserForm(): UserFormModel {
    return {
      id: null,
      firstName: '',
      lastName: '',
      email: '',
      username: '',
      department: '',
      phone: '',
      roles: ['EMPLOYEE'],
      isActive: true
    };
  }

  private getEmptyDepartmentForm(): DepartmentFormModel {
    return {
      id: null,
      name: '',
      code: '',
      description: '',
      managerName: '',
      isActive: true
    };
  }
}
