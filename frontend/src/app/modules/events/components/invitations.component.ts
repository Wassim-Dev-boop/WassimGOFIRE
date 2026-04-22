import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InvitationService } from '../../../core/services/invitation.service';
import { AuthService } from '../../../core/services/auth.service';
import { AppRole, Invitation, InvitationStatus } from '../../../core/models';

type InvitationTab = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'PARTNER_ACCESS';

@Component({
  selector: 'app-invitations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <section class="rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 class="mb-1 text-2xl font-bold text-gray-900 dark:text-white/90 lg:text-3xl">Invitations</h1>
            <p class="max-w-2xl text-sm text-gray-600 dark:text-gray-400">
              Suivi des invitations aux evenements et verification des acces partenaires.
            </p>
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <span class="inline-flex rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-700 dark:text-brand-300">
                {{ roleLabels[currentRole] }}
              </span>
              <span class="inline-flex rounded-full bg-success-500/10 px-3 py-1 text-xs font-semibold text-success-700 dark:text-success-300">
                Controle invitations actif
              </span>
            </div>
          </div>
        </div>

        <div class="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
          <article class="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
            <p class="text-3xl font-semibold text-gray-900 dark:text-white/90">{{ getTabCount('PENDING') }}</p>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">En attente</p>
          </article>

          <article class="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
            <p class="text-3xl font-semibold text-gray-900 dark:text-white/90">{{ getTabCount('ACCEPTED') }}</p>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Acceptees</p>
          </article>

          <article class="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
            <p class="text-3xl font-semibold text-gray-900 dark:text-white/90">{{ getTabCount('DECLINED') }}</p>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Refusees</p>
          </article>

          <article class="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
            <p class="text-3xl font-semibold text-gray-900 dark:text-white/90">{{ getPendingPartnerVerificationCount() }}</p>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Partenaires a verifier</p>
          </article>
        </div>

        <div class="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
          <input
            type="text"
            [(ngModel)]="searchTerm"
            placeholder="Rechercher un evenement, expediteur, partenaire..."
            class="h-11 w-full rounded-xl border border-gray-300 bg-transparent px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          />

          <button
            type="button"
            (click)="resetSearch()"
            class="h-11 rounded-xl border border-gray-300 px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
          >
            Reinitialiser
          </button>
        </div>
      </section>

      <section class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div class="mb-5 flex flex-wrap gap-2">
          <button
            *ngFor="let tab of visibleTabs"
            (click)="activeTab = tab.value"
            [ngClass]="activeTab === tab.value
              ? 'border-brand-500 bg-brand-500 text-white'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/[0.03]'"
            class="rounded-xl border px-4 py-2 text-sm font-semibold transition"
          >
            {{ tab.label }}
            <span class="ml-1 text-xs">({{ getTabCount(tab.value) }})</span>
          </button>
        </div>

        <div
          *ngIf="actionFeedback"
          class="mb-4 rounded-xl border px-4 py-2 text-sm"
          [ngClass]="actionFeedbackTone === 'success'
            ? 'border-success-200 bg-success-50 text-success-700 dark:border-success-500/40 dark:bg-success-500/10 dark:text-success-300'
            : 'border-error-200 bg-error-50 text-error-700 dark:border-error-500/40 dark:bg-error-500/10 dark:text-error-300'"
        >
          {{ actionFeedback }}
        </div>

        <div *ngIf="activeTab === 'PARTNER_ACCESS'" class="space-y-3">
          <div *ngIf="filteredPartnerInvitations.length === 0" class="rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            Aucune invitation partenaire trouvee pour ce contexte.
          </div>

          <article
            *ngFor="let invitation of filteredPartnerInvitations"
            class="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900"
          >
            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 class="text-base font-semibold text-gray-900 dark:text-white/90">{{ invitation.eventTitle }}</h3>
                <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Partenaire: {{ invitation.recipientName }} ({{ invitation.recipientEmail }})
                </p>
                <p class="text-sm text-gray-600 dark:text-gray-400">Organisation: {{ invitation.partnerOrganization || 'N/A' }}</p>
                <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Envoyee par {{ invitation.senderName }} le {{ invitation.sentAt | date:'short' }}
                </p>
                <p *ngIf="invitation.isVerifiedByDsn" class="mt-1 text-xs text-success-600 dark:text-success-300">
                  Verifiee par {{ invitation.verifiedBy || 'DSN' }} le {{ invitation.verifiedAt | date:'short' }}
                </p>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <span
                  *ngIf="invitation.isVerifiedByDsn"
                  class="inline-flex rounded-full bg-success-500/10 px-3 py-1 text-xs font-semibold text-success-700 dark:text-success-300"
                >
                  Verifie
                </span>

                <button
                  *ngIf="!invitation.isVerifiedByDsn && canVerifyPartnerAccess()"
                  (click)="verifyPartnerAccess(invitation.id)"
                  class="rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-600"
                >
                  Verifier acces
                </button>
              </div>
            </div>
          </article>
        </div>

        <div *ngIf="activeTab !== 'PARTNER_ACCESS'" class="space-y-3">
          <div *ngIf="filteredInvitations.length === 0" class="rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            Aucune invitation dans cet onglet.
          </div>

          <article
            *ngFor="let invitation of filteredInvitations"
            class="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900"
          >
            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div class="min-w-0 flex-1">
                <h3 class="truncate text-base font-semibold text-gray-900 dark:text-white/90">{{ invitation.eventTitle }}</h3>
                <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Expediteur: {{ invitation.senderName }}</p>

                <div class="mt-3 grid grid-cols-1 gap-2 text-sm text-gray-600 sm:grid-cols-2 dark:text-gray-300">
                  <p><span class="font-semibold">Date:</span> {{ invitation.eventDate | date:'short' }}</p>
                  <p><span class="font-semibold">Lieu:</span> {{ invitation.eventLocation }}</p>
                </div>

                <p *ngIf="invitation.message" class="mt-2 text-sm italic text-gray-500 dark:text-gray-400">
                  "{{ invitation.message }}"
                </p>

                <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Envoyee le {{ invitation.sentAt | date:'short' }}
                  <span *ngIf="invitation.respondedAt">- Reponse le {{ invitation.respondedAt | date:'short' }}</span>
                </p>
              </div>

              <div class="flex min-w-[140px] flex-col gap-2">
                <span class="rounded-full px-3 py-1 text-center text-xs font-semibold" [ngClass]="getInvitationStatusBadgeClass(invitation.status)">
                  {{ getInvitationStatusLabel(invitation.status) }}
                </span>

                <div *ngIf="invitation.status === 'PENDING'" class="grid grid-cols-1 gap-2">
                  <button
                    (click)="acceptInvitation(invitation.id)"
                    class="rounded-lg bg-success-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-success-600"
                  >
                    Accepter
                  </button>
                  <button
                    (click)="declineInvitation(invitation.id)"
                    class="rounded-lg bg-error-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-error-600"
                  >
                    Refuser
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  `,
  styles: []
})
export class InvitationsComponent implements OnInit {
  invitations: Invitation[] = [];
  partnerInvitations: Invitation[] = [];
  activeTab: InvitationTab = 'PENDING';
  isLoading = false;

  currentRole: AppRole = 'EMPLOYEE';
  currentUserId = '';
  currentUserName = '';

  searchTerm = '';
  actionFeedback = '';
  actionFeedbackTone: 'success' | 'error' = 'success';

  readonly roleLabels: Record<AppRole, string> = {
    ADMIN: 'Administrateur',
    EMPLOYEE: 'Employe',
    MANAGER: 'Chef hierarchique',
    ROOM_MANAGER: 'Responsable salle',
    SECURITY_MANAGER: 'Responsable securite',
    DSN_DIRECTOR: 'Directeur DSN',
    QUALITY_MANAGER: 'Responsable qualite'
  };

  constructor(
    private invitationService: InvitationService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      if (!user) {
        return;
      }

      this.currentRole = user.role;
      this.currentUserId = user.id;
      this.currentUserName = `${user.firstName} ${user.lastName}`.trim();
      this.loadInvitations();
      if (this.canVerifyPartnerAccess()) {
        this.loadPartnerInvitations();
      } else {
        this.partnerInvitations = [];
      }
    });
  }

  get visibleTabs(): Array<{ label: string; value: InvitationTab }> {
    const baseTabs: Array<{ label: string; value: InvitationTab }> = [
      { label: 'En attente', value: 'PENDING' },
      { label: 'Acceptees', value: 'ACCEPTED' },
      { label: 'Refusees', value: 'DECLINED' }
    ];

    if (this.canVerifyPartnerAccess()) {
      baseTabs.push({ label: 'Acces partenaires', value: 'PARTNER_ACCESS' });
    }

    return baseTabs;
  }

  get filteredInvitations(): Invitation[] {
    return this.invitations
      .filter(invitation => invitation.status === this.activeTab)
      .filter(invitation => this.matchesSearch(invitation));
  }

  get filteredPartnerInvitations(): Invitation[] {
    return this.partnerInvitations.filter(invitation => this.matchesSearch(invitation));
  }

  loadInvitations(): void {
    this.isLoading = true;
    this.invitationService.getInvitationsByUser(this.currentUserId).subscribe({
      next: (invitations) => {
        this.invitations = invitations;
        this.isLoading = false;
      },
      error: () => {
        this.invitations = [];
        this.actionFeedbackTone = 'error';
        this.actionFeedback = 'Impossible de charger les invitations pour le moment.';
        this.isLoading = false;
      }
    });
  }

  loadPartnerInvitations(): void {
    if (!this.canVerifyPartnerAccess()) {
      this.partnerInvitations = [];
      return;
    }

    this.invitationService.getPartnerInvitations().subscribe(invitations => {
      this.partnerInvitations = invitations;
    }, () => {
      this.partnerInvitations = [];
      this.actionFeedbackTone = 'error';
      this.actionFeedback = 'Impossible de charger les invitations partenaires.';
    });
  }

  canVerifyPartnerAccess(): boolean {
    return this.currentRole === 'ADMIN' || this.currentRole === 'DSN_DIRECTOR';
  }

  acceptInvitation(id: string): void {
    this.invitationService.acceptInvitation(id).subscribe(() => {
      this.actionFeedbackTone = 'success';
      this.actionFeedback = 'Invitation acceptee.';
      this.loadInvitations();
    });
  }

  declineInvitation(id: string): void {
    const reason = prompt('Motif du refus (optionnel):');
    this.invitationService.declineInvitation(id, reason || undefined).subscribe(() => {
      this.actionFeedbackTone = 'success';
      this.actionFeedback = 'Invitation refusee.';
      this.loadInvitations();
    });
  }

  verifyPartnerAccess(id: string): void {
    if (!this.canVerifyPartnerAccess()) {
      this.actionFeedbackTone = 'error';
      this.actionFeedback = 'Votre role ne peut pas verifier les acces partenaires.';
      return;
    }

    this.invitationService.verifyPartnerAccess(id, this.currentUserName).subscribe(() => {
      this.actionFeedbackTone = 'success';
      this.actionFeedback = 'Acces partenaire verifie avec succes.';
      this.loadPartnerInvitations();
    });
  }

  getTabCount(tab: InvitationTab): number {
    if (tab === 'PARTNER_ACCESS') {
      return this.partnerInvitations.length;
    }

    return this.invitations.filter(invitation => invitation.status === tab).length;
  }

  getPendingPartnerVerificationCount(): number {
    return this.partnerInvitations.filter(invitation => !invitation.isVerifiedByDsn).length;
  }

  getInvitationStatusLabel(status: InvitationStatus): string {
    const labelMap: Record<InvitationStatus, string> = {
      PENDING: 'EN ATTENTE',
      ACCEPTED: 'ACCEPTEE',
      DECLINED: 'REFUSEE',
      CANCELLED: 'ANNULEE'
    };
    return labelMap[status];
  }

  getInvitationStatusBadgeClass(status: InvitationStatus): string {
    const classMap: Record<InvitationStatus, string> = {
      PENDING: 'bg-warning-500/10 text-warning-700 dark:text-warning-300',
      ACCEPTED: 'bg-success-500/10 text-success-700 dark:text-success-300',
      DECLINED: 'bg-error-500/10 text-error-700 dark:text-error-300',
      CANCELLED: 'bg-slate-500/10 text-slate-700 dark:text-slate-300'
    };
    return classMap[status];
  }

  resetSearch(): void {
    this.searchTerm = '';
  }

  private matchesSearch(invitation: Invitation): boolean {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return true;
    }

    return [
      invitation.eventTitle,
      invitation.eventLocation,
      invitation.senderName,
      invitation.recipientName,
      invitation.recipientEmail,
      invitation.partnerOrganization || '',
      invitation.message || '',
      invitation.status
    ]
      .join(' ')
      .toLowerCase()
      .includes(term);
  }
}
