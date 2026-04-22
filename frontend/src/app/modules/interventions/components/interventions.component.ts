import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InterventionService } from '../../../core/services/intervention.service';
import { AuthService } from '../../../core/services/auth.service';
import { AppRole, Intervention, InterventionStatus, InterventionPriority } from '../../../core/models';
import { Option, SelectComponent } from '../../../shared/components/form/select/select.component';
import { HttpErrorResponse } from '@angular/common/http';
import { hasBackendToken } from '../../../core/config/backend-api.config';

@Component({
  selector: 'app-interventions',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectComponent],
  template: `
    <div class="container mx-auto px-4 py-6">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-gray-800 mb-2">Technical Interventions</h1>
        <p class="text-gray-600">Submit requests and manage intervention lifecycle by role</p>
        <div class="mt-2 inline-flex rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-700">
          Role: {{ roleLabels[currentRole] }}
        </div>
        <div
          *ngIf="submissionMessage"
          class="mt-3 rounded-lg px-4 py-2 text-sm font-medium"
          [ngClass]="submissionMessageType === 'success'
            ? 'bg-green-100 text-green-800 border border-green-200'
            : 'bg-red-100 text-red-800 border border-red-200'"
        >
          {{ submissionMessage }}
        </div>
      </div>

      <button
        *ngIf="canCreateIntervention()"
        (click)="showCreateForm = !showCreateForm"
        class="mb-6 px-6 py-3 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition font-semibold"
      >
        + Create New Request
      </button>

      <div *ngIf="showCreateForm" class="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 class="text-xl font-bold mb-4">Submit Technical Request</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input type="text" [(ngModel)]="newIntervention.title" placeholder="Issue Title" class="px-4 py-2 border border-gray-300 rounded-lg" />
          <app-select
            [(ngModel)]="newIntervention.priority"
            [options]="createPriorityOptions"
            placeholder="Priority"
          ></app-select>
          <app-select
            [(ngModel)]="newIntervention.type"
            [options]="createTypeOptions"
            placeholder="Type"
          ></app-select>
          <input type="text" [(ngModel)]="newIntervention.location" placeholder="Location" class="px-4 py-2 border border-gray-300 rounded-lg" />
          <textarea [(ngModel)]="newIntervention.description" placeholder="Detailed description" rows="4" class="px-4 py-2 border border-gray-300 rounded-lg md:col-span-2"></textarea>
        </div>
        <div class="mt-4 flex gap-2">
          <button (click)="createIntervention()" class="px-6 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition">Submit Request</button>
          <button (click)="showCreateForm = false" class="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition">Cancel</button>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-md p-4 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <app-select
            [(ngModel)]="filterStatus"
            (ngModelChange)="applyFilters()"
            [options]="statusFilterOptions"
            placeholder="All Status"
          ></app-select>
          <app-select
            [(ngModel)]="filterPriority"
            (ngModelChange)="applyFilters()"
            [options]="priorityFilterOptions"
            placeholder="All Priority"
          ></app-select>
          <input type="text" [(ngModel)]="searchTerm" (input)="applyFilters()" placeholder="Search..." class="px-4 py-2 border border-gray-300 rounded-lg" />
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-md overflow-hidden">
        <table class="w-full">
          <thead class="bg-gray-100 border-b">
            <tr>
              <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Title</th>
              <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Priority</th>
              <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
              <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Assigned To</th>
              <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Created</th>
              <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let intervention of filteredInterventions" class="border-b hover:bg-gray-50">
              <td class="px-6 py-4">
                <div class="font-medium text-gray-900">{{ intervention.title }}</div>
                <div class="text-sm text-gray-500">{{ intervention.location }}</div>
              </td>
              <td class="px-6 py-4">
                <span
                  [ngClass]="{
                    'bg-green-100 text-green-800': intervention.priority === 'LOW',
                    'bg-yellow-100 text-yellow-800': intervention.priority === 'MEDIUM',
                    'bg-orange-100 text-orange-800': intervention.priority === 'HIGH',
                    'bg-red-100 text-red-800': intervention.priority === 'CRITICAL'
                  }"
                  class="px-3 py-1 rounded-full text-xs font-semibold"
                >
                  {{ intervention.priority }}
                </span>
              </td>
              <td class="px-6 py-4">
                <span
                  [ngClass]="{
                    'bg-blue-100 text-blue-800': intervention.status === 'OPEN',
                    'bg-purple-100 text-purple-800': intervention.status === 'ASSIGNED',
                    'bg-indigo-100 text-indigo-800': intervention.status === 'IN_PROGRESS',
                    'bg-green-100 text-green-800': intervention.status === 'RESOLVED',
                    'bg-gray-100 text-gray-800': intervention.status === 'CLOSED'
                  }"
                  class="px-3 py-1 rounded-full text-xs font-semibold"
                >
                  {{ intervention.status }}
                </span>
              </td>
              <td class="px-6 py-4 text-sm text-gray-600">{{ intervention.assignment?.technicianName || '-' }}</td>
              <td class="px-6 py-4 text-sm text-gray-600">{{ intervention.createdAt | date:'short' }}</td>
              <td class="px-6 py-4 text-sm">
                <button (click)="viewIntervention(intervention)" class="text-brand-500 hover:text-brand-700 mr-3">View</button>
                <button *ngIf="canManageInterventions() && intervention.status === 'OPEN'" (click)="assignIntervention(intervention)" class="text-indigo-500 hover:text-indigo-700 mr-3">Assign</button>
                <button *ngIf="canManageInterventions() && intervention.status === 'ASSIGNED'" (click)="startIntervention(intervention)" class="text-purple-500 hover:text-purple-700 mr-3">Start</button>
                <button *ngIf="canManageInterventions() && intervention.status === 'IN_PROGRESS'" (click)="resolveIntervention(intervention)" class="text-success-600 hover:text-success-700 mr-3">Resolve</button>
                <button *ngIf="canManageInterventions() && intervention.status === 'RESOLVED'" (click)="closeIntervention(intervention)" class="text-gray-600 hover:text-gray-700">Close</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div *ngIf="filteredInterventions.length === 0" class="text-center py-12 text-gray-500">No interventions found</div>
      </div>
    </div>
  `,
  styles: []
})
export class InterventionsComponent implements OnInit {
  interventions: Intervention[] = [];
  filteredInterventions: Intervention[] = [];
  showCreateForm = false;
  isAuthenticated = false;

  filterStatus = '';
  filterPriority = '';
  searchTerm = '';

  currentRole: AppRole = 'EMPLOYEE';
  currentUserId = '';
  currentUserUsername = '';
  currentUserName = '';
  currentUserEmail = '';
  submissionMessage = '';
  submissionMessageType: 'success' | 'error' = 'success';

  readonly roleLabels: Record<AppRole, string> = {
    ADMIN: 'Administrateur',
    EMPLOYEE: 'Employe',
    MANAGER: 'Chef hierarchique',
    ROOM_MANAGER: 'Responsable salle',
    SECURITY_MANAGER: 'Responsable securite',
    DSN_DIRECTOR: 'Directeur DSN',
    QUALITY_MANAGER: 'Responsable qualite'
  };

  readonly createPriorityOptions: Option[] = [
    { value: 'LOW', label: 'Low Priority' },
    { value: 'MEDIUM', label: 'Medium Priority' },
    { value: 'HIGH', label: 'High Priority' },
    { value: 'CRITICAL', label: 'Critical' },
  ];

  readonly createTypeOptions: Option[] = [
    { value: 'MAINTENANCE', label: 'Maintenance' },
    { value: 'REPAIR', label: 'Repair' },
    { value: 'SUPPORT', label: 'Support' },
    { value: 'INSTALLATION', label: 'Installation' },
  ];

  readonly statusFilterOptions: Option[] = [
    { value: '', label: 'All Status' },
    { value: 'OPEN', label: 'Open' },
    { value: 'ASSIGNED', label: 'Assigned' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'RESOLVED', label: 'Resolved' },
    { value: 'CLOSED', label: 'Closed' },
  ];

  readonly priorityFilterOptions: Option[] = [
    { value: '', label: 'All Priority' },
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGH', label: 'High' },
    { value: 'CRITICAL', label: 'Critical' },
  ];

  newIntervention: {
    title: string;
    description: string;
    type: Intervention['type'];
    priority: InterventionPriority;
    location: string;
  } = {
    title: '',
    description: '',
    type: 'SUPPORT',
    priority: InterventionPriority.MEDIUM,
    location: ''
  };

  constructor(
    private interventionService: InterventionService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      if (!user) {
        this.isAuthenticated = false;
        this.interventions = [];
        this.filteredInterventions = [];
        this.setSubmissionError('Session expiree. Reconnectez-vous puis reessayez.');
        return;
      }

      this.isAuthenticated = true;
      this.currentRole = user.role;
      this.currentUserId = user.id;
      this.currentUserUsername = (user.username || '').trim();
      this.currentUserName = `${user.firstName} ${user.lastName}`.trim();
      this.currentUserEmail = user.email;
      this.clearSubmissionMessage();
      this.loadInterventions();
    });
  }

  canCreateIntervention(): boolean {
    return this.isAuthenticated && (this.currentRole === 'EMPLOYEE' || this.currentRole === 'MANAGER');
  }

  canManageInterventions(): boolean {
    return this.isAuthenticated
      && (this.currentRole === 'ROOM_MANAGER' || this.currentRole === 'ADMIN')
      && this.authService.hasPermission('CHANGE_INTERVENTION_STATUS');
  }

  loadInterventions(): void {
    const mineOnly = !this.canManageInterventions();
    this.interventionService.getInterventions({ mine: mineOnly }).subscribe({
      next: (interventions) => {
        this.interventions = Array.isArray(interventions) ? interventions : [];
        this.applyFilters();
      },
      error: (error) => {
        console.error('Interventions loading failed', error);
        this.setSubmissionError(this.toLoadErrorMessage(error));
      }
    });
  }

  createIntervention(): void {
    this.clearSubmissionMessage();

    if (!this.canCreateIntervention()) {
      this.setSubmissionError('Demande refusee: ce role ne peut pas creer d intervention.');
      return;
    }

    if (!hasBackendToken()) {
      this.setSubmissionError('Session expiree. Reconnectez-vous puis reessayez.');
      return;
    }

    if (!this.newIntervention.title.trim() || !this.newIntervention.description.trim()) {
      this.setSubmissionError('Titre et description sont obligatoires.');
      return;
    }

    this.interventionService.createIntervention({
      ...this.newIntervention,
      requesterId: this.currentUserId,
      requesterName: this.currentUserName,
      requesterEmail: this.currentUserEmail
    }).subscribe({
      next: () => {
        this.loadInterventions();
        this.showCreateForm = false;
        const successMessage = 'Demande validee: ticket enregistre et soumis au responsable.';
        this.setSubmissionSuccess(successMessage);
        alert(successMessage);
        this.newIntervention = {
          title: '',
          description: '',
          type: 'SUPPORT',
          priority: InterventionPriority.MEDIUM,
          location: ''
        };
      },
      error: (error) => {
        console.error('Intervention creation failed', error);
        const errorMessage = this.toCreateErrorMessage(error);
        this.setSubmissionError(errorMessage);
        alert(errorMessage);
      }
    });
  }

  private getRoleScopedInterventions(): Intervention[] {
    // The backend already applies role scoping (mine=true for non-managers).
    // Avoid client-side identity filtering to prevent hiding valid rows.
    return [...this.interventions];
  }

  private setSubmissionSuccess(message: string): void {
    this.submissionMessageType = 'success';
    this.submissionMessage = message;
  }

  private setSubmissionError(message: string): void {
    this.submissionMessageType = 'error';
    this.submissionMessage = message;
  }

  private clearSubmissionMessage(): void {
    this.submissionMessage = '';
  }

  private toCreateErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) {
        return 'Demande non validee: session expiree (401). Reconnectez-vous.';
      }
      if (error.status === 403) {
        return 'Demande non validee: droits insuffisants (403).';
      }
      if (error.status === 400) {
        return 'Demande non validee: donnees invalides (400).';
      }
      if (error.status === 0) {
        return 'Demande non validee: backend inaccessible.';
      }
    }

    return 'Demande non validee: echec de soumission du ticket.';
  }

  private toLoadErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) {
        return 'Chargement non valide: session expiree (401). Reconnectez-vous.';
      }
      if (error.status === 403) {
        return 'Chargement non valide: acces refuse (403).';
      }
      if (error.status === 0) {
        return 'Chargement non valide: backend inaccessible.';
      }
    }

    return 'Chargement non valide: impossible de recuperer les interventions.';
  }

  applyFilters(): void {
    let filtered = this.getRoleScopedInterventions();

    if (this.filterStatus) {
      filtered = filtered.filter(item => item.status === this.filterStatus);
    }

    if (this.filterPriority) {
      filtered = filtered.filter(item => item.priority === this.filterPriority);
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term)
      );
    }

    this.filteredInterventions = filtered;
  }

  viewIntervention(intervention: Intervention): void {
    alert(`${intervention.title}\n\n${intervention.description}`);
  }

  assignIntervention(intervention: Intervention): void {
    if (!this.canManageInterventions()) {
      return;
    }

    const technicianName = prompt('Technician name', intervention.assignment?.technicianName || 'Tech Team');
    if (!technicianName || !technicianName.trim()) {
      return;
    }

    const technicianId = technicianName.toLowerCase().replace(/\s+/g, '-');
    this.interventionService.assignIntervention(intervention.id, technicianId, technicianName.trim()).subscribe(() => {
      this.loadInterventions();
    });
  }

  startIntervention(intervention: Intervention): void {
    if (!intervention.assignment || !this.canManageInterventions()) {
      return;
    }

    this.interventionService.updateAssignment(intervention.id, {
      startedAt: new Date()
    }).subscribe(() => {
      this.loadInterventions();
    });
  }

  resolveIntervention(intervention: Intervention): void {
    if (!this.canManageInterventions()) {
      return;
    }

    const resolution = prompt('Resolution details', 'Issue fixed and validated.');
    if (!resolution || !resolution.trim()) {
      return;
    }

    this.interventionService.completeIntervention(intervention.id, resolution.trim()).subscribe(() => {
      this.loadInterventions();
    });
  }

  closeIntervention(intervention: Intervention): void {
    if (!this.canManageInterventions()) {
      return;
    }

    this.interventionService.closeIntervention(intervention.id).subscribe(() => {
      this.loadInterventions();
    });
  }
}
