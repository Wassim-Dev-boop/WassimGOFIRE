import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppRole, Room, RoomReservation } from '../../../core/models';
import { AuthService } from '../../../core/services/auth.service';
import { ReservationService } from '../../../core/services/reservation.service';
import { Option, SelectComponent } from '../../../shared/components/form/select/select.component';

type RoomVisualStatus = 'LIBRE' | 'OCCUPEE' | 'MAINTENANCE';
type RoomStatusFilter = 'all' | 'available' | 'occupied' | 'maintenance';
type CapacityFilter = 'all' | 'small' | 'medium' | 'large';

@Component({
  selector: 'app-room-reservations',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectComponent],
  template: `
    <div class="space-y-6">
      <div class="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 class="mb-1 text-2xl font-bold text-gray-900 dark:text-white/90 lg:text-3xl">Reservations des salles</h1>
            <p class="max-w-2xl text-sm text-gray-600 dark:text-gray-400">
              Pilotage des disponibilites, suivi d occupation et gestion rapide des demandes de reservation.
            </p>
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <span class="inline-flex rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-700 dark:text-brand-300">
                {{ roleLabels[currentRole] }}
              </span>
              <span class="inline-flex rounded-full bg-success-500/10 px-3 py-1 text-xs font-semibold text-success-700 dark:text-success-300">
                Gestion salles active
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
            <p class="text-3xl font-semibold text-gray-900 dark:text-white/90">{{ totalRooms }}</p>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Salles total</p>
          </article>

          <article class="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
            <p class="text-3xl font-semibold text-success-600 dark:text-success-300">{{ availableRoomsCount }}</p>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Disponibles</p>
          </article>

          <article class="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
            <p class="text-3xl font-semibold text-error-600 dark:text-error-300">{{ occupiedRoomsCount }}</p>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Occupees</p>
          </article>

          <article class="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
            <p class="text-3xl font-semibold text-warning-600 dark:text-warning-300">{{ maintenanceRoomsCount }}</p>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Maintenance</p>
          </article>
        </div>

        <div class="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px_220px_auto] lg:items-center">
          <input
            type="text"
            [(ngModel)]="searchTerm"
            placeholder="Rechercher une salle..."
            class="h-11 w-full rounded-xl border border-gray-300 bg-transparent px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          />

          <app-select
            [(ngModel)]="statusFilter"
            [options]="statusFilterOptions"
            placeholder="Toutes"
          ></app-select>

          <app-select
            [(ngModel)]="capacityFilter"
            [options]="capacityFilterOptions"
            placeholder="Capacite"
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

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <article
          *ngFor="let room of filteredRooms"
          class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
        >
          <div class="mb-3 flex items-start justify-between gap-3">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white/90">{{ room.name }}</h3>
            <span
              class="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
              [ngClass]="getStatusBadgeClass(getRoomStatus(room))"
            >
              {{ getStatusLabel(getRoomStatus(room)) }}
            </span>
          </div>

          <p class="mb-3 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-gray-400">
              <path d="M8 11C8 8.79086 9.79086 7 12 7C14.2091 7 16 8.79086 16 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
              <path d="M5 17C5 14.7909 6.79086 13 9 13H15C17.2091 13 19 14.7909 19 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
            </svg>
            {{ room.capacity }} personnes
          </p>

          <div class="mb-4">
            <div class="mb-2 flex items-center justify-between text-sm">
              <span class="text-gray-600 dark:text-gray-300">Taux occupation : {{ getRoomOccupancy(room) }}%</span>
            </div>
            <div class="h-2.5 rounded-full bg-gray-200 dark:bg-gray-800">
              <div
                class="h-2.5 rounded-full"
                [ngClass]="getOccupancyBarClass(getRoomStatus(room))"
                [style.width.%]="getRoomOccupancy(room)"
              ></div>
            </div>
          </div>

          <div class="mb-4 flex flex-wrap gap-2">
            <span
              *ngFor="let amenity of room.amenities"
              class="inline-flex rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              {{ amenity }}
            </span>
          </div>

          <button
            type="button"
            (click)="openReservationModal(room)"
            [disabled]="getRoomStatus(room) !== 'LIBRE' || !canCreateReservations()"
            class="h-11 w-full rounded-lg border border-gray-300 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700"
            [ngClass]="
              getRoomStatus(room) === 'LIBRE'
                ? 'text-gray-800 hover:bg-gray-100 dark:text-white/90 dark:hover:bg-white/[0.03]'
                : 'text-gray-500 dark:text-gray-400'
            "
          >
            {{ getRoomStatus(room) === 'LIBRE' ? 'Reserver' : 'Indisponible' }}
          </button>
        </article>
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
              <h2 class="text-xl font-semibold text-gray-900 dark:text-white/90">Nouvelle reservation de salle</h2>
              <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Selectionnez une salle puis renseignez la demande.</p>
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
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Salle</label>
              <app-select
                [(ngModel)]="selectedRoomId"
                [options]="reservableRoomOptions"
                placeholder="Choisir une salle"
              ></app-select>
            </div>

            <div class="sm:col-span-2">
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Titre</label>
              <input
                type="text"
                [(ngModel)]="roomBooking.title"
                placeholder="Ex: Reunion hebdomadaire"
                class="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
            </div>

            <div class="sm:col-span-2">
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Motif</label>
              <textarea
                rows="3"
                [(ngModel)]="roomBooking.purpose"
                class="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              ></textarea>
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Debut</label>
              <input
                type="datetime-local"
                [(ngModel)]="roomBooking.startDate"
                class="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Fin</label>
              <input
                type="datetime-local"
                [(ngModel)]="roomBooking.endDate"
                class="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Participants</label>
              <input
                type="number"
                min="1"
                [(ngModel)]="roomBooking.attendeeCount"
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
                (click)="bookRoom()"
                [disabled]="!canSubmitRoomBooking"
                class="h-11 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirmer la reservation
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class RoomReservationsComponent implements OnInit {
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

  rooms: Room[] = [];
  roomReservations: RoomReservation[] = [];

  searchTerm = '';
  statusFilter: RoomStatusFilter = 'all';
  capacityFilter: CapacityFilter = 'all';

  isModalOpen = false;
  selectedRoomId = '';

  readonly statusFilterOptions: Option[] = [
    { value: 'all', label: 'Toutes' },
    { value: 'available', label: 'Libre' },
    { value: 'occupied', label: 'Occupee' },
    { value: 'maintenance', label: 'Maintenance' },
  ];

  readonly capacityFilterOptions: Option[] = [
    { value: 'all', label: 'Capacite' },
    { value: 'small', label: 'Petite (<= 10)' },
    { value: 'medium', label: 'Moyenne (11-30)' },
    { value: 'large', label: 'Grande (> 30)' },
  ];

  get reservableRoomOptions(): Option[] {
    return this.reservableRooms.map((room) => ({
      value: room.id,
      label: `${room.name} (${room.capacity} places)`,
    }));
  }

  feedbackMessage = '';
  feedbackTone: 'success' | 'error' = 'success';

  roomBooking = {
    title: '',
    purpose: '',
    startDate: '',
    endDate: '',
    attendeeCount: 1,
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
    this.reservationService.getRooms().subscribe((rooms) => {
      this.rooms = rooms;
    });

    this.reservationService.getRoomReservations().subscribe((reservations) => {
      this.roomReservations = reservations;
    });
  }

  get filteredRooms(): Room[] {
    const normalizedSearch = this.searchTerm.trim().toLowerCase();

    return this.rooms.filter((room) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        room.name.toLowerCase().includes(normalizedSearch) ||
        room.description.toLowerCase().includes(normalizedSearch) ||
        room.location.toLowerCase().includes(normalizedSearch) ||
        room.amenities.some((amenity) => amenity.toLowerCase().includes(normalizedSearch));

      if (!matchesSearch) {
        return false;
      }

      const status = this.getRoomStatus(room);
      if (this.statusFilter === 'available' && status !== 'LIBRE') {
        return false;
      }
      if (this.statusFilter === 'occupied' && status !== 'OCCUPEE') {
        return false;
      }
      if (this.statusFilter === 'maintenance' && status !== 'MAINTENANCE') {
        return false;
      }

      if (this.capacityFilter === 'small' && room.capacity > 10) {
        return false;
      }
      if (this.capacityFilter === 'medium' && (room.capacity <= 10 || room.capacity > 30)) {
        return false;
      }
      if (this.capacityFilter === 'large' && room.capacity <= 30) {
        return false;
      }

      return true;
    });
  }

  get reservableRooms(): Room[] {
    return this.rooms.filter((room) => this.getRoomStatus(room) === 'LIBRE');
  }

  get canSubmitRoomBooking(): boolean {
    return (
      this.selectedRoomId.length > 0 &&
      this.roomBooking.title.trim().length > 0 &&
      this.roomBooking.startDate.length > 0 &&
      this.roomBooking.endDate.length > 0 &&
      this.roomBooking.attendeeCount > 0
    );
  }

  get totalRooms(): number {
    return this.rooms.length;
  }

  get availableRoomsCount(): number {
    return this.rooms.filter((room) => this.getRoomStatus(room) === 'LIBRE').length;
  }

  get occupiedRoomsCount(): number {
    return this.rooms.filter((room) => this.getRoomStatus(room) === 'OCCUPEE').length;
  }

  get maintenanceRoomsCount(): number {
    return this.rooms.filter((room) => this.getRoomStatus(room) === 'MAINTENANCE').length;
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

  getRoomStatus(room: Room): RoomVisualStatus {
    if (!room.isActive) {
      return 'MAINTENANCE';
    }

    if (this.hasCurrentReservation(room.id)) {
      return 'OCCUPEE';
    }

    return 'LIBRE';
  }

  getRoomOccupancy(room: Room): number {
    const activeReservations = this.roomReservations.filter(
      (reservation) =>
        reservation.roomId === room.id &&
        (reservation.status === 'APPROVED' || reservation.status === 'PENDING'),
    );
    const reservedSeats = activeReservations.reduce((total, reservation) => (
      total + Math.max(reservation.attendeeCount || 0, 0)
    ), 0);
    const capacity = Math.max(room.capacity, 1);
    const occupancy = Math.min(100, Math.round((reservedSeats / capacity) * 100));

    return room.isActive ? occupancy : 0;
  }

  getStatusLabel(status: RoomVisualStatus): string {
    if (status === 'LIBRE') {
      return 'Libre';
    }
    if (status === 'OCCUPEE') {
      return 'Occupee';
    }

    return 'Maintenance';
  }

  getStatusBadgeClass(status: RoomVisualStatus): string {
    if (status === 'LIBRE') {
      return 'bg-success-50 text-success-700 dark:bg-success-500/20 dark:text-success-300';
    }
    if (status === 'OCCUPEE') {
      return 'bg-error-50 text-error-700 dark:bg-error-500/20 dark:text-error-300';
    }

    return 'bg-warning-50 text-warning-700 dark:bg-warning-500/20 dark:text-warning-300';
  }

  getOccupancyBarClass(status: RoomVisualStatus): string {
    if (status === 'LIBRE') {
      return 'bg-success-500';
    }
    if (status === 'OCCUPEE') {
      return 'bg-error-500';
    }

    return 'bg-warning-500';
  }

  openReservationModal(room: Room): void {
    if (!this.canCreateReservations() || this.getRoomStatus(room) !== 'LIBRE') {
      return;
    }

    this.selectedRoomId = room.id;
    this.initializeBookingWindow();
    this.isModalOpen = true;
  }

  openNewReservationModal(): void {
    if (!this.canCreateReservations()) {
      return;
    }

    const firstRoom = this.reservableRooms[0];
    this.selectedRoomId = firstRoom ? firstRoom.id : '';
    this.initializeBookingWindow();
    this.isModalOpen = true;
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.statusFilter = 'all';
    this.capacityFilter = 'all';
  }

  closeModal(): void {
    this.isModalOpen = false;
  }

  bookRoom(): void {
    if (!this.canSubmitRoomBooking) {
      return;
    }

    const selectedRoom = this.rooms.find((room) => room.id === this.selectedRoomId);
    if (!selectedRoom) {
      this.showFeedback('Veuillez selectionner une salle valide.', 'error');
      return;
    }

    const startDate = new Date(this.roomBooking.startDate);
    const endDate = new Date(this.roomBooking.endDate);

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      startDate >= endDate
    ) {
      this.showFeedback('La plage horaire est invalide.', 'error');
      return;
    }

    this.reservationService
      .bookRoom({
        roomId: selectedRoom.id,
        roomName: selectedRoom.name,
        userId: this.currentUserId,
        userName: this.currentUserName,
        title: this.roomBooking.title.trim(),
        purpose: this.roomBooking.purpose.trim(),
        startDate,
        endDate,
        attendeeCount: this.roomBooking.attendeeCount,
      })
      .subscribe((result) => {
        if (!result) {
          this.showFeedback('Conflit detecte: la salle est deja reservee sur ce creneau.', 'error');
          return;
        }

        this.showFeedback('Reservation de salle enregistree.', 'success');
        this.loadData();
        this.closeModal();
      });
  }

  private initializeBookingWindow(): void {
    const now = new Date();
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);

    this.roomBooking = {
      title: '',
      purpose: '',
      startDate: this.toDateTimeLocal(now),
      endDate: this.toDateTimeLocal(inOneHour),
      attendeeCount: 1,
    };
  }

  private hasCurrentReservation(roomId: string): boolean {
    const now = Date.now();

    return this.roomReservations.some((reservation) => {
      if (reservation.roomId !== roomId) {
        return false;
      }

      if (reservation.status !== 'APPROVED' && reservation.status !== 'PENDING') {
        return false;
      }

      const start = reservation.startDate instanceof Date
        ? reservation.startDate.getTime()
        : new Date(reservation.startDate).getTime();
      const end = reservation.endDate instanceof Date
        ? reservation.endDate.getTime()
        : new Date(reservation.endDate).getTime();

      return start <= now && now <= end;
    });
  }

  private showFeedback(message: string, tone: 'success' | 'error'): void {
    this.feedbackMessage = message;
    this.feedbackTone = tone;
  }

  private toDateTimeLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

}
