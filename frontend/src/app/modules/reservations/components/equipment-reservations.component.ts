import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppRole, Equipment, EquipmentReservation } from '../../../core/models';
import { AuthService } from '../../../core/services/auth.service';
import { ReservationService } from '../../../core/services/reservation.service';
import { Option, SelectComponent } from '../../../shared/components/form/select/select.component';

type EquipmentVisualStatus = 'DISPONIBLE' | 'EN_COURS' | 'INDISPONIBLE';
type EquipmentStatusFilter = 'all' | 'available' | 'in-use' | 'unavailable';

interface EquipmentRowView {
  item: Equipment;
  availableQty: number;
  totalQty: number;
  status: EquipmentVisualStatus;
  reservedBy: string;
  expectedReturn: string;
}

type ReserveActionState = 'ready' | 'no-permission' | 'no-stock';

@Component({
  selector: 'app-equipment-reservations',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectComponent],
  template: `
    <div class="space-y-6">
      <div class="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 class="mb-1 text-2xl font-bold text-gray-900 dark:text-white/90 lg:text-3xl">Reservations equipements</h1>
            <p class="max-w-2xl text-sm text-gray-600 dark:text-gray-400">
              Supervision des stocks, prets en cours et disponibilites des equipements partages.
            </p>
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <span class="inline-flex rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-700 dark:text-brand-300">
                {{ roleLabels[currentRole] }}
              </span>
              <span class="inline-flex rounded-full bg-success-500/10 px-3 py-1 text-xs font-semibold text-success-700 dark:text-success-300">
                Gestion equipements active
              </span>
            </div>
          </div>

          <button
            type="button"
            (click)="openNewReservationModal()"
            [disabled]="!canCreateReservations()"
            class="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-success-500 px-4 text-sm font-semibold text-white transition hover:bg-success-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span class="text-lg leading-none">+</span>
            Nouvelle reservation
          </button>
        </div>

        <div class="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
          <article class="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
            <p class="text-3xl font-semibold text-gray-900 dark:text-white/90">{{ totalEquipments }}</p>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Stock total</p>
          </article>

          <article class="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
            <p class="text-3xl font-semibold text-warning-600 dark:text-warning-300">{{ activeLoans }}</p>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Prets en cours</p>
          </article>

          <article class="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
            <p class="text-3xl font-semibold text-success-600 dark:text-success-300">{{ usageRate }}%</p>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Taux utilisation</p>
          </article>

          <article class="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
            <p class="text-3xl font-semibold text-brand-600 dark:text-brand-300">{{ returnsTonight }}</p>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Retours imminents</p>
          </article>
        </div>

        <div class="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px_220px_auto] lg:items-center">
          <input
            type="text"
            [(ngModel)]="searchTerm"
            placeholder="Rechercher un equipement..."
            class="h-11 w-full rounded-xl border border-gray-300 bg-transparent px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          />

          <app-select
            [(ngModel)]="categoryFilter"
            [options]="categoryFilterOptions"
            placeholder="Toutes categories"
          ></app-select>

          <app-select
            [(ngModel)]="statusFilter"
            [options]="statusFilterOptions"
            placeholder="Tous statuts"
          ></app-select>

          <button
            type="button"
            (click)="resetFilters()"
            class="h-11 rounded-xl border border-gray-300 px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
          >
            Reinitialiser
          </button>
        </div>
      </div>

      <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div class="overflow-x-auto">
          <table class="min-w-full">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-800">
                <th class="px-6 py-4 text-left text-sm font-semibold text-gray-500 dark:text-gray-400">Equipement</th>
                <th class="px-4 py-4 text-left text-sm font-semibold text-gray-500 dark:text-gray-400">Categorie</th>
                <th class="px-4 py-4 text-left text-sm font-semibold text-gray-500 dark:text-gray-400">Qte dispo</th>
                <th class="px-4 py-4 text-left text-sm font-semibold text-gray-500 dark:text-gray-400">Statut</th>
                <th class="px-4 py-4 text-left text-sm font-semibold text-gray-500 dark:text-gray-400">Reserve par</th>
                <th class="px-4 py-4 text-left text-sm font-semibold text-gray-500 dark:text-gray-400">Retour prevu</th>
                <th class="px-4 py-4 text-right text-sm font-semibold text-gray-500 dark:text-gray-400">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of filteredRows" class="border-b border-gray-200 dark:border-gray-800">
                <td class="px-6 py-4 align-top">
                  <div class="text-base font-semibold text-gray-900 dark:text-white/90">{{ row.item.name }}</div>
                  <div class="text-sm text-gray-500 dark:text-gray-400">{{ row.item.description }}</div>
                </td>
                <td class="px-4 py-4 align-top">
                  <span class="inline-flex rounded-full px-3 py-1 text-xs font-semibold" [ngClass]="getCategoryBadgeClass(row.item.category)">
                    {{ getCategoryLabel(row.item.category) }}
                  </span>
                </td>
                <td class="px-4 py-4 align-top text-2sm font-semibold text-gray-800 dark:text-gray-100">{{ row.availableQty }} / {{ row.totalQty }}</td>
                <td class="px-4 py-4 align-top">
                  <span class="inline-flex rounded-full px-3 py-1 text-xs font-semibold" [ngClass]="getStatusBadgeClass(row.status)">
                    {{ getStatusLabel(row.status) }}
                  </span>
                </td>
                <td class="px-4 py-4 align-top text-2sm text-gray-800 dark:text-gray-200">{{ row.reservedBy }}</td>
                <td class="px-4 py-4 align-top text-2sm text-gray-800 dark:text-gray-200">{{ row.expectedReturn }}</td>
                <td class="px-4 py-4 align-top text-right">
                  <button
                    type="button"
                    (click)="onReserveClick(row)"
                    class="h-11 rounded-lg border border-gray-300 px-5 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-55 dark:border-gray-700"
                    [ngClass]="getReserveActionState(row) === 'ready'
                      ? 'text-gray-800 hover:bg-gray-100 dark:text-white/90 dark:hover:bg-white/[0.03]'
                      : 'text-gray-500 dark:text-gray-400'"
                  >
                    {{ getReserveActionState(row) === 'ready' ? 'Reserver' : 'Complet' }}
                  </button>
                </td>
              </tr>

              <tr *ngIf="filteredRows.length === 0">
                <td colspan="7" class="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                  Aucun equipement ne correspond aux filtres.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div
        *ngIf="feedbackMessage"
        class="rounded-xl border px-4 py-3 text-sm"
        [ngClass]="feedbackTone === 'success'
          ? 'border-success-200 bg-success-50 text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300'
          : 'border-error-200 bg-error-50 text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300'"
      >
        {{ feedbackMessage }}
      </div>

      <div
        *ngIf="isModalOpen"
        class="fixed inset-0 z-[110000] flex items-center justify-center bg-gray-950/60 p-4"
      >
        <div class="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:p-6">
          <div class="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 class="text-xl font-semibold text-gray-900 dark:text-white/90">Reservation equipement</h2>
              <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Definissez la plage de pret.</p>
            </div>
            <button
              type="button"
              (click)="closeModal()"
              class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
            >
              x
            </button>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="sm:col-span-2">
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Equipement</label>
              <app-select
                [(ngModel)]="selectedEquipmentId"
                [options]="reservableEquipmentOptions"
                placeholder="Choisir un equipement"
              ></app-select>
            </div>

            <div class="sm:col-span-2">
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Motif</label>
              <textarea
                rows="3"
                [(ngModel)]="bookingForm.purpose"
                class="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              ></textarea>
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Debut</label>
              <input
                type="datetime-local"
                [(ngModel)]="bookingForm.startDate"
                class="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Fin</label>
              <input
                type="datetime-local"
                [(ngModel)]="bookingForm.endDate"
                class="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
            </div>

            <div class="sm:col-span-2 flex justify-end gap-2 pt-2">
              <button
                type="button"
                (click)="closeModal()"
                class="h-11 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
              >
                Annuler
              </button>
              <button
                type="button"
                (click)="reserveEquipment()"
                [disabled]="!canSubmitEquipmentBooking"
                class="h-11 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class EquipmentReservationsComponent implements OnInit {
  currentRole: AppRole = 'EMPLOYEE';
  currentUserId = '';
  currentUserName = '';

  readonly roleLabels: Record<AppRole, string> = {
    ADMIN: 'Administrateur',
    EMPLOYEE: 'Employe',
    MANAGER: 'Chef hierarchique',
    ROOM_MANAGER: 'Responsable salle',
    SECURITY_MANAGER: 'Responsable securite',
    DSN_DIRECTOR: 'Directeur DSN',
    QUALITY_MANAGER: 'Responsable qualite',
  };

  equipment: Equipment[] = [];
  equipmentReservations: EquipmentReservation[] = [];

  searchTerm = '';
  categoryFilter: 'all' | Equipment['category'] = 'all';
  statusFilter: EquipmentStatusFilter = 'all';

  isModalOpen = false;
  selectedEquipmentId = '';

  readonly categoryFilterOptions: Option[] = [
    { value: 'all', label: 'Toutes categories' },
    { value: 'PROJECTOR', label: 'Projecteurs' },
    { value: 'LAPTOP', label: 'Ordinateurs' },
    { value: 'CAMERA', label: 'Cameras' },
    { value: 'MICROPHONE', label: 'Microphones' },
    { value: 'SCREEN', label: 'Ecrans' },
    { value: 'OTHER', label: 'Autre' },
  ];

  readonly statusFilterOptions: Option[] = [
    { value: 'all', label: 'Tous statuts' },
    { value: 'available', label: 'Disponible' },
    { value: 'in-use', label: 'En cours' },
    { value: 'unavailable', label: 'Indisponible' },
  ];

  get reservableEquipmentOptions(): Option[] {
    return this.reservableRows.map((row) => ({
      value: row.item.id,
      label: `${row.item.name} (${row.availableQty} / ${row.totalQty} dispo)`,
    }));
  }

  feedbackMessage = '';
  feedbackTone: 'success' | 'error' = 'success';

  bookingForm = {
    purpose: '',
    startDate: '',
    endDate: '',
  };

  constructor(
    private reservationService: ReservationService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe((user) => {
      if (!user) {
        return;
      }

      this.currentRole = user.role;
      this.currentUserId = user.id;
      this.currentUserName = `${user.firstName} ${user.lastName}`.trim();
    });

    this.loadData();
  }

  loadData(): void {
    this.reservationService.getEquipment().subscribe((equipment) => {
      this.equipment = equipment;
    });

    this.reservationService.getEquipmentReservations().subscribe((reservations) => {
      this.equipmentReservations = reservations;
    });
  }

  get allRows(): EquipmentRowView[] {
    return this.equipment.map((item) => this.toRow(item));
  }

  get filteredRows(): EquipmentRowView[] {
    const normalizedSearch = this.searchTerm.trim().toLowerCase();

    return this.allRows.filter((row) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        row.item.name.toLowerCase().includes(normalizedSearch) ||
        row.item.description.toLowerCase().includes(normalizedSearch);

      if (!matchesSearch) {
        return false;
      }

      if (this.categoryFilter !== 'all' && row.item.category !== this.categoryFilter) {
        return false;
      }

      if (this.statusFilter === 'available' && row.status !== 'DISPONIBLE') {
        return false;
      }
      if (this.statusFilter === 'in-use' && row.status !== 'EN_COURS') {
        return false;
      }
      if (this.statusFilter === 'unavailable' && row.status !== 'INDISPONIBLE') {
        return false;
      }

      return true;
    });
  }

  get reservableRows(): EquipmentRowView[] {
    return this.allRows.filter((row) => row.status === 'DISPONIBLE' && row.availableQty > 0);
  }

  get canSubmitEquipmentBooking(): boolean {
    return (
      this.selectedEquipmentId.length > 0 &&
      this.bookingForm.purpose.trim().length > 0 &&
      this.bookingForm.startDate.length > 0 &&
      this.bookingForm.endDate.length > 0
    );
  }

  get totalEquipments(): number {
    return this.allRows.reduce((accumulator, row) => accumulator + row.totalQty, 0);
  }

  get activeLoans(): number {
    return this.allRows.reduce(
      (accumulator, row) => accumulator + Math.max(row.totalQty - row.availableQty, 0),
      0,
    );
  }

  get usageRate(): number {
    if (this.totalEquipments === 0) {
      return 0;
    }

    return Math.round((this.activeLoans / this.totalEquipments) * 100);
  }

  get returnsTonight(): number {
    const today = this.formatDateShort(new Date());
    return this.allRows.filter((row) => row.expectedReturn === today).length;
  }

  canCreateReservations(): boolean {
    return [
      'ADMIN',
      'EMPLOYEE',
      'MANAGER',
      'ROOM_MANAGER',
      'SECURITY_MANAGER',
      'DSN_DIRECTOR',
      'QUALITY_MANAGER',
    ].includes(this.currentRole);
  }

  openReservationModal(item: Equipment): void {
    const row = this.allRows.find((candidate) => candidate.item.id === item.id);
    if (!row || row.status !== 'DISPONIBLE' || row.availableQty <= 0 || !this.canCreateReservations()) {
      return;
    }

    this.selectedEquipmentId = item.id;
    this.initializeBookingWindow();
    this.isModalOpen = true;
  }

  onReserveClick(row: EquipmentRowView): void {
    const actionState = this.getReserveActionState(row);
    if (actionState === 'no-permission') {
      this.showFeedback('Votre role ne permet pas de reserver des equipements.', 'error');
      return;
    }

    if (actionState === 'no-stock') {
      this.showFeedback('Cet equipement est actuellement indisponible.', 'error');
      return;
    }

    this.openReservationModal(row.item);
  }

  openNewReservationModal(): void {
    if (!this.canCreateReservations()) {
      return;
    }

    const firstRow = this.reservableRows[0];
    this.selectedEquipmentId = firstRow ? firstRow.item.id : '';
    this.initializeBookingWindow();
    this.isModalOpen = true;
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.categoryFilter = 'all';
    this.statusFilter = 'all';
  }

  closeModal(): void {
    this.isModalOpen = false;
  }

  reserveEquipment(): void {
    if (!this.canSubmitEquipmentBooking) {
      return;
    }

    const selectedItem = this.equipment.find((item) => item.id === this.selectedEquipmentId);
    if (!selectedItem) {
      this.showFeedback('Veuillez selectionner un equipement valide.', 'error');
      return;
    }

    const startDate = new Date(this.bookingForm.startDate);
    const endDate = new Date(this.bookingForm.endDate);

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      startDate >= endDate
    ) {
      this.showFeedback('La plage horaire est invalide.', 'error');
      return;
    }

    this.reservationService
      .reserveEquipment({
        equipmentId: selectedItem.id,
        equipmentName: selectedItem.name,
        userId: this.currentUserId,
        userName: this.currentUserName,
        purpose: this.bookingForm.purpose.trim(),
        startDate,
        endDate,
      })
      .subscribe({
        next: (result) => {
          if (!result) {
            this.showFeedback('Reservation impossible pour cet equipement.', 'error');
            return;
          }

          this.showFeedback('Reservation equipement enregistree.', 'success');
          this.loadData();
          this.closeModal();
        },
        error: () => {
          this.showFeedback('Erreur serveur lors de la reservation. Reessayez.', 'error');
        },
      });
  }

  getReserveActionState(row: EquipmentRowView): ReserveActionState {
    if (!this.canCreateReservations()) {
      return 'no-permission';
    }

    if (row.status !== 'DISPONIBLE' || row.availableQty <= 0) {
      return 'no-stock';
    }

    return 'ready';
  }

  getCategoryLabel(category: Equipment['category']): string {
    if (category === 'LAPTOP' || category === 'SCREEN') {
      return 'Informatique';
    }
    if (category === 'OTHER') {
      return 'Autre';
    }

    return 'Audiovisuel';
  }

  getCategoryBadgeClass(category: Equipment['category']): string {
    if (category === 'LAPTOP' || category === 'SCREEN') {
      return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300';
    }
    if (category === 'OTHER') {
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }

    return 'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300';
  }

  getStatusLabel(status: EquipmentVisualStatus): string {
    if (status === 'DISPONIBLE') {
      return 'Disponible';
    }
    if (status === 'EN_COURS') {
      return 'En cours';
    }

    return 'Indisponible';
  }

  getStatusBadgeClass(status: EquipmentVisualStatus): string {
    if (status === 'DISPONIBLE') {
      return 'bg-success-50 text-success-700 dark:bg-success-500/20 dark:text-success-300';
    }
    if (status === 'EN_COURS') {
      return 'bg-warning-50 text-warning-700 dark:bg-warning-500/20 dark:text-warning-300';
    }

    return 'bg-error-50 text-error-700 dark:bg-error-500/20 dark:text-error-300';
  }

  private toRow(item: Equipment): EquipmentRowView {
    const totalQty = 1;
    const activeReservations = this.getActiveReservations(item.id);

    const blockedByStatus = item.status === 'MAINTENANCE' || item.status === 'RETIRED';
    const usedByStatus = item.status === 'IN_USE' || activeReservations.length > 0;

    const availableQty = blockedByStatus || usedByStatus ? 0 : totalQty;

    const status = this.resolveStatus(item, availableQty, totalQty);

    const reservedBy = activeReservations.length > 0
      ? this.unique(activeReservations.map((reservation) => reservation.userName)).join(', ')
      : '--';

    const expectedReturn = this.getExpectedReturn(activeReservations);

    return {
      item,
      availableQty,
      totalQty,
      status,
      reservedBy,
      expectedReturn,
    };
  }

  private resolveStatus(
    item: Equipment,
    availableQty: number,
    totalQty: number,
  ): EquipmentVisualStatus {
    if (item.status === 'MAINTENANCE' || item.status === 'RETIRED') {
      return 'INDISPONIBLE';
    }

    if (availableQty === totalQty) {
      return 'DISPONIBLE';
    }

    return 'EN_COURS';
  }

  private getActiveReservations(equipmentId: string): EquipmentReservation[] {
    return this.equipmentReservations.filter((reservation) => {
      if (reservation.equipmentId !== equipmentId) {
        return false;
      }

      return reservation.status === 'PENDING' || reservation.status === 'APPROVED' || reservation.status === 'IN_USE';
    });
  }

  private getExpectedReturn(activeReservations: EquipmentReservation[]): string {
    if (activeReservations.length === 0) {
      return '--';
    }

    const nearestReturn = activeReservations
      .map((reservation) => reservation.endDate instanceof Date ? reservation.endDate : new Date(reservation.endDate))
      .sort((left, right) => left.getTime() - right.getTime())[0];

    return this.formatDateShort(nearestReturn);
  }

  private initializeBookingWindow(): void {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    this.bookingForm = {
      purpose: '',
      startDate: this.toDateTimeLocal(now),
      endDate: this.toDateTimeLocal(tomorrow),
    };
  }

  private showFeedback(message: string, tone: 'success' | 'error'): void {
    this.feedbackMessage = message;
    this.feedbackTone = tone;
  }

  private formatDateShort(date: Date): string {
    const months = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  }

  private toDateTimeLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  private unique(values: string[]): string[] {
    return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
  }
}
