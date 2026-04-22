import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';
import { buildApiUrl, extractPageContent, ApiPageResponse } from '../config/backend-api.config';
import { AuthService } from './auth.service';
import {
  Room,
  RoomReservation,
  Equipment,
  EquipmentReservation,
  RoomAvailability,
} from '../models';

type BackendReservationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface BackendRoomResponse {
  id: string;
  name: string;
  location: string;
  capacity: number;
  active: boolean;
  createdAt?: string;
}

interface BackendEquipmentResponse {
  id: string;
  name: string;
  serialNumber: string;
  description?: string;
  active: boolean;
  createdAt?: string;
}

interface BackendReservationResponse {
  id: string;
  roomId?: string | null;
  equipmentId?: string | null;
  requesterUsername: string;
  startAt: string;
  endAt: string;
  purpose?: string;
  status: BackendReservationStatus;
  createdAt?: string;
  updatedAt?: string;
}

interface BackendSecurityValidationRequest {
  approved: boolean;
}

interface BackendReservationCreateRequest {
  roomId?: string;
  equipmentId?: string;
  startAt: string;
  endAt: string;
  purpose: string;
}

interface BackendConflictCheckResponse {
  conflict: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private roomsSubject = new BehaviorSubject<Room[]>([]);
  public rooms$ = this.roomsSubject.asObservable();

  private equipmentSubject = new BehaviorSubject<Equipment[]>([]);
  public equipment$ = this.equipmentSubject.asObservable();

  private roomReservationsSubject = new BehaviorSubject<RoomReservation[]>([]);
  public roomReservations$ = this.roomReservationsSubject.asObservable();

  private equipmentReservationsSubject = new BehaviorSubject<EquipmentReservation[]>([]);
  public equipmentReservations$ = this.equipmentReservationsSubject.asObservable();

  constructor(private http: HttpClient, private authService: AuthService) {}

  // Room Methods
  getRooms(): Observable<Room[]> {
    if (!this.shouldUseBackendRequests()) {
      return of(this.roomsSubject.value);
    }

    if (!this.canReadRoomInventoryFromBackend()) {
      return of(this.roomsSubject.value);
    }

    const request$ = this.http
      .get<ApiPageResponse<BackendRoomResponse>>(buildApiUrl('/api/v1/rooms'))
      .pipe(
        map((response) => extractPageContent(response).map((item) => this.mapRoom(item))),
        tap((rooms) => this.roomsSubject.next(rooms)),
      );

    return this.withFallback(request$, () => of(this.roomsSubject.value));
  }

  getRoomById(id: string): Observable<Room | undefined> {
    if (!this.shouldUseBackendRequests()) {
      return of(this.roomsSubject.value.find((item) => item.id === id));
    }

    if (!this.canReadRoomInventoryFromBackend()) {
      return of(this.roomsSubject.value.find((item) => item.id === id));
    }

    const request$ = this.http
      .get<BackendRoomResponse>(buildApiUrl(`/api/v1/rooms/${id}`))
      .pipe(map((room) => this.mapRoom(room)));

    return this.withFallback(request$, () => of(this.roomsSubject.value.find((item) => item.id === id)));
  }

  addRoom(room: Omit<Room, 'id' | 'createdAt'>): Observable<Room> {
    const payload = {
      name: room.name,
      location: room.location,
      capacity: room.capacity,
      active: room.isActive,
    };

    const request$ = this.http
      .post<BackendRoomResponse>(buildApiUrl('/api/v1/rooms'), payload)
      .pipe(
        map((response) => this.mapRoom(response)),
        tap((created) => this.roomsSubject.next([...this.roomsSubject.value, created])),
      );

    return this.withFallback(request$, () => {
      const created: Room = { ...room, id: this.generateId(), createdAt: new Date() };
      this.roomsSubject.next([...this.roomsSubject.value, created]);
      return of(created);
    });
  }

  updateRoom(id: string, updates: Partial<Room>): Observable<Room | null> {
    const existing = this.roomsSubject.value.find((room) => room.id === id);
    if (!existing) {
      return of(null);
    }

    const payload = {
      name: updates.name ?? existing.name,
      location: updates.location ?? existing.location,
      capacity: updates.capacity ?? existing.capacity,
      active: updates.isActive ?? existing.isActive,
    };

    const request$ = this.http
      .put<BackendRoomResponse>(buildApiUrl(`/api/v1/rooms/${id}`), payload)
      .pipe(
        map((response) => this.mapRoom(response)),
        tap((updated) => this.replaceRoom(updated)),
      );

    return this.withFallback(request$, () => {
      const updated: Room = { ...existing, ...updates };
      this.replaceRoom(updated);
      return of(updated);
    });
  }

  deleteRoom(id: string): Observable<boolean> {
    const request$ = this.http
      .delete<void>(buildApiUrl(`/api/v1/rooms/${id}`))
      .pipe(
        map(() => true),
        tap(() => this.roomsSubject.next(this.roomsSubject.value.filter((room) => room.id !== id))),
      );

    return this.withFallback(request$, () => {
      this.roomsSubject.next(this.roomsSubject.value.filter((room) => room.id !== id));
      return of(true);
    });
  }

  // Equipment Methods
  getEquipment(): Observable<Equipment[]> {
    if (!this.shouldUseBackendRequests()) {
      return of(this.equipmentSubject.value);
    }

    if (!this.canReadEquipmentInventoryFromBackend()) {
      return of(this.equipmentSubject.value);
    }

    const request$ = this.http
      .get<ApiPageResponse<BackendEquipmentResponse>>(buildApiUrl('/api/v1/equipments'))
      .pipe(
        map((response) => extractPageContent(response).map((item) => this.mapEquipment(item))),
        tap((equipment) => this.equipmentSubject.next(equipment)),
      );

    return this.withFallback(request$, () => of(this.equipmentSubject.value));
  }

  getEquipmentById(id: string): Observable<Equipment | undefined> {
    if (!this.shouldUseBackendRequests()) {
      return of(this.equipmentSubject.value.find((item) => item.id === id));
    }

    if (!this.canReadEquipmentInventoryFromBackend()) {
      return of(this.equipmentSubject.value.find((item) => item.id === id));
    }

    const request$ = this.http
      .get<BackendEquipmentResponse>(buildApiUrl(`/api/v1/equipments/${id}`))
      .pipe(map((response) => this.mapEquipment(response)));

    return this.withFallback(request$, () => of(this.equipmentSubject.value.find((item) => item.id === id)));
  }

  addEquipment(equipment: Omit<Equipment, 'id' | 'createdAt'>): Observable<Equipment> {
    const payload = {
      name: equipment.name,
      serialNumber: equipment.serialNumber,
      description: equipment.description,
      active: equipment.status !== 'MAINTENANCE' && equipment.status !== 'RETIRED',
    };

    const request$ = this.http
      .post<BackendEquipmentResponse>(buildApiUrl('/api/v1/equipments'), payload)
      .pipe(
        map((response) => this.mapEquipment(response)),
        tap((created) => this.equipmentSubject.next([...this.equipmentSubject.value, created])),
      );

    return this.withFallback(request$, () => {
      const created: Equipment = { ...equipment, id: this.generateId(), createdAt: new Date() };
      this.equipmentSubject.next([...this.equipmentSubject.value, created]);
      return of(created);
    });
  }

  updateEquipment(id: string, updates: Partial<Equipment>): Observable<Equipment | null> {
    const existing = this.equipmentSubject.value.find((item) => item.id === id);
    if (!existing) {
      return of(null);
    }

    const payload = {
      name: updates.name ?? existing.name,
      serialNumber: updates.serialNumber ?? existing.serialNumber,
      description: updates.description ?? existing.description,
      active: (updates.status ?? existing.status) !== 'MAINTENANCE' && (updates.status ?? existing.status) !== 'RETIRED',
    };

    const request$ = this.http
      .put<BackendEquipmentResponse>(buildApiUrl(`/api/v1/equipments/${id}`), payload)
      .pipe(
        map((response) => this.mapEquipment(response)),
        tap((updated) => this.replaceEquipment(updated)),
      );

    return this.withFallback(request$, () => {
      const updated: Equipment = { ...existing, ...updates };
      this.replaceEquipment(updated);
      return of(updated);
    });
  }

  deleteEquipment(id: string): Observable<boolean> {
    const request$ = this.http
      .delete<void>(buildApiUrl(`/api/v1/equipments/${id}`))
      .pipe(
        map(() => true),
        tap(() => this.equipmentSubject.next(this.equipmentSubject.value.filter((item) => item.id !== id))),
      );

    return this.withFallback(request$, () => {
      this.equipmentSubject.next(this.equipmentSubject.value.filter((item) => item.id !== id));
      return of(true);
    });
  }

  // Room Reservation Methods
  getRoomReservations(): Observable<RoomReservation[]> {
    if (!this.shouldUseBackendRequests()) {
      return of(this.roomReservationsSubject.value);
    }

    const request$ = this.fetchReservations().pipe(
      map((reservations) => reservations.filter((item) => !!item.roomId).map((item) => this.mapRoomReservation(item))),
      tap((mapped) => this.roomReservationsSubject.next(mapped)),
    );

    return this.withFallback(request$, () => of(this.roomReservationsSubject.value));
  }

  getRoomReservationsByRoom(roomId: string): Observable<RoomReservation[]> {
    return this.getRoomReservations().pipe(
      map((reservations) => reservations.filter((reservation) => reservation.roomId === roomId)),
    );
  }

  getPendingRoomReservations(): Observable<RoomReservation[]> {
    return this.getRoomReservations().pipe(
      map((reservations) => reservations.filter((reservation) => reservation.status === 'PENDING')),
    );
  }

  bookRoom(reservation: Omit<RoomReservation, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Observable<RoomReservation | null> {
    if (!this.shouldUseBackendRequests()) {
      const conflicts = this.checkRoomConflicts(reservation.roomId, reservation.startDate, reservation.endDate);
      if (conflicts.length > 0) {
        return of(null);
      }

      const created: RoomReservation = {
        ...reservation,
        id: this.generateId(),
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.roomReservationsSubject.next([...this.roomReservationsSubject.value, created]);
      return of(created);
    }

    const payload: BackendReservationCreateRequest = {
      roomId: reservation.roomId,
      startAt: reservation.startDate.toISOString(),
      endAt: reservation.endDate.toISOString(),
      purpose: reservation.purpose || reservation.title,
    };

    const createRequest$ = this.http
      .post<BackendReservationResponse>(buildApiUrl('/api/v1/reservations'), payload)
      .pipe(
        map((response) => this.mapRoomReservation(response)),
        tap((created) => this.roomReservationsSubject.next([...this.roomReservationsSubject.value, created])),
      );

    const request$ = this.checkBackendConflict(reservation.roomId, undefined, reservation.startDate, reservation.endDate).pipe(
      switchMap((hasConflict) => (hasConflict ? of(null) : createRequest$)),
    );

    return this.withFallback(request$, () => {
      const conflicts = this.checkRoomConflicts(reservation.roomId, reservation.startDate, reservation.endDate);
      if (conflicts.length > 0) {
        return of(null);
      }

      const created: RoomReservation = {
        ...reservation,
        id: this.generateId(),
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.roomReservationsSubject.next([...this.roomReservationsSubject.value, created]);
      return of(created);
    });
  }

  getReservationConflicts(reservationId: string): Observable<RoomReservation[]> {
    const currentReservation = this.roomReservationsSubject.value.find((item) => item.id === reservationId);
    if (!currentReservation) {
      return of([]);
    }

    const conflicts = this.roomReservationsSubject.value.filter((reservation) =>
      reservation.id !== reservationId &&
      reservation.roomId === currentReservation.roomId &&
      (reservation.status === 'APPROVED' || reservation.status === 'PENDING') &&
      !(currentReservation.endDate <= reservation.startDate || currentReservation.startDate >= reservation.endDate),
    );

    return of(conflicts);
  }

  approveRoomReservation(id: string, approvedBy: string): Observable<RoomReservation | null> {
    return this.securityValidateReservation(id, true, () => {
      const updated = this.roomReservationsSubject.value.find((reservation) => reservation.id === id) ?? null;
      if (!updated) {
        return of(null);
      }

      updated.status = 'APPROVED';
      updated.approvedBy = approvedBy;
      updated.approvalDate = new Date();
      updated.updatedAt = new Date();
      this.roomReservationsSubject.next([...this.roomReservationsSubject.value]);
      return of(updated);
    });
  }

  rejectRoomReservation(id: string): Observable<RoomReservation | null> {
    return this.securityValidateReservation(id, false, () => {
      const updated = this.roomReservationsSubject.value.find((reservation) => reservation.id === id) ?? null;
      if (!updated) {
        return of(null);
      }

      updated.status = 'REJECTED';
      updated.updatedAt = new Date();
      this.roomReservationsSubject.next([...this.roomReservationsSubject.value]);
      return of(updated);
    });
  }

  cancelRoomReservation(id: string): Observable<RoomReservation | null> {
    const reservation = this.roomReservationsSubject.value.find((item) => item.id === id) ?? null;
    if (!reservation) {
      return of(null);
    }

    reservation.status = 'CANCELLED';
    reservation.updatedAt = new Date();
    this.roomReservationsSubject.next([...this.roomReservationsSubject.value]);
    return of(reservation);
  }

  getRoomAvailability(roomId: string, date: Date): Observable<RoomAvailability> {
    const reservations = this.roomReservationsSubject.value.filter((reservation) =>
      reservation.roomId === roomId &&
      reservation.startDate.toDateString() === date.toDateString() &&
      (reservation.status === 'APPROVED' || reservation.status === 'PENDING'),
    );

    const occupiedSlots = reservations.map((reservation) => ({
      startTime: this.timeToString(reservation.startDate),
      endTime: this.timeToString(reservation.endDate),
    }));

    const availability: RoomAvailability = {
      roomId,
      date,
      availableTimeSlots: this.calculateAvailableSlots(occupiedSlots),
    };

    return of(availability);
  }

  // Equipment Reservation Methods
  getEquipmentReservations(): Observable<EquipmentReservation[]> {
    if (!this.shouldUseBackendRequests()) {
      return of(this.equipmentReservationsSubject.value);
    }

    const request$ = this.fetchReservations().pipe(
      map((reservations) => reservations.filter((item) => !!item.equipmentId).map((item) => this.mapEquipmentReservation(item))),
      tap((mapped) => this.equipmentReservationsSubject.next(mapped)),
    );

    return this.withFallback(request$, () => of(this.equipmentReservationsSubject.value));
  }

  getEquipmentReservationsByEquipment(equipmentId: string): Observable<EquipmentReservation[]> {
    return this.getEquipmentReservations().pipe(
      map((reservations) => reservations.filter((reservation) => reservation.equipmentId === equipmentId)),
    );
  }

  getPendingEquipmentReservations(): Observable<EquipmentReservation[]> {
    return this.getEquipmentReservations().pipe(
      map((reservations) => reservations.filter((reservation) => reservation.status === 'PENDING')),
    );
  }

  reserveEquipment(reservation: Omit<EquipmentReservation, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Observable<EquipmentReservation | null> {
    if (!this.shouldUseBackendRequests()) {
      const equipment = this.equipmentSubject.value.find((item) => item.id === reservation.equipmentId);
      if (!equipment || equipment.status === 'MAINTENANCE' || equipment.status === 'RETIRED') {
        return of(null);
      }

      const created: EquipmentReservation = {
        ...reservation,
        id: this.generateId(),
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.equipmentReservationsSubject.next([...this.equipmentReservationsSubject.value, created]);
      return of(created);
    }

    const payload: BackendReservationCreateRequest = {
      equipmentId: reservation.equipmentId,
      startAt: reservation.startDate.toISOString(),
      endAt: reservation.endDate.toISOString(),
      purpose: reservation.purpose,
    };

    const createRequest$ = this.http
      .post<BackendReservationResponse>(buildApiUrl('/api/v1/reservations'), payload)
      .pipe(
        map((response) => this.mapEquipmentReservation(response)),
        tap((created) => this.equipmentReservationsSubject.next([...this.equipmentReservationsSubject.value, created])),
      );

    const request$ = this.checkBackendConflict(undefined, reservation.equipmentId, reservation.startDate, reservation.endDate).pipe(
      switchMap((hasConflict) => (hasConflict ? of(null) : createRequest$)),
    );

    return this.withFallback(request$, () => {
      const equipment = this.equipmentSubject.value.find((item) => item.id === reservation.equipmentId);
      if (!equipment || equipment.status === 'MAINTENANCE' || equipment.status === 'RETIRED') {
        return of(null);
      }

      const created: EquipmentReservation = {
        ...reservation,
        id: this.generateId(),
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.equipmentReservationsSubject.next([...this.equipmentReservationsSubject.value, created]);
      return of(created);
    });
  }

  approveEquipmentReservation(id: string): Observable<EquipmentReservation | null> {
    return this.securityValidateEquipmentReservation(id, true, () => {
      const reservation = this.equipmentReservationsSubject.value.find((item) => item.id === id) ?? null;
      if (!reservation) {
        return of(null);
      }

      reservation.status = 'APPROVED';
      reservation.approvalDate = new Date();
      reservation.updatedAt = new Date();
      this.equipmentReservationsSubject.next([...this.equipmentReservationsSubject.value]);
      return of(reservation);
    });
  }

  rejectEquipmentReservation(id: string): Observable<EquipmentReservation | null> {
    return this.securityValidateEquipmentReservation(id, false, () => {
      const reservation = this.equipmentReservationsSubject.value.find((item) => item.id === id) ?? null;
      if (!reservation) {
        return of(null);
      }

      reservation.status = 'CANCELLED';
      reservation.updatedAt = new Date();
      this.equipmentReservationsSubject.next([...this.equipmentReservationsSubject.value]);
      return of(reservation);
    });
  }

  pickupEquipment(id: string): Observable<EquipmentReservation | null> {
    const reservation = this.equipmentReservationsSubject.value.find((item) => item.id === id) ?? null;
    if (!reservation) {
      return of(null);
    }

    reservation.status = 'IN_USE';
    reservation.pickedUpAt = new Date();
    reservation.updatedAt = new Date();

    const equipment = this.equipmentSubject.value.find((item) => item.id === reservation.equipmentId);
    if (equipment) {
      equipment.status = 'IN_USE';
      this.equipmentSubject.next([...this.equipmentSubject.value]);
    }

    this.equipmentReservationsSubject.next([...this.equipmentReservationsSubject.value]);
    return of(reservation);
  }

  returnEquipment(id: string): Observable<EquipmentReservation | null> {
    const reservation = this.equipmentReservationsSubject.value.find((item) => item.id === id) ?? null;
    if (!reservation) {
      return of(null);
    }

    reservation.status = 'RETURNED';
    reservation.returnedAt = new Date();
    reservation.updatedAt = new Date();

    const equipment = this.equipmentSubject.value.find((item) => item.id === reservation.equipmentId);
    if (equipment) {
      equipment.status = 'AVAILABLE';
      this.equipmentSubject.next([...this.equipmentSubject.value]);
    }

    this.equipmentReservationsSubject.next([...this.equipmentReservationsSubject.value]);
    return of(reservation);
  }

  private fetchReservations(): Observable<BackendReservationResponse[]> {
    return this.http
      .get<ApiPageResponse<BackendReservationResponse>>(buildApiUrl('/api/v1/reservations'))
      .pipe(map((response) => extractPageContent(response)));
  }

  private securityValidateReservation(
    id: string,
    approved: boolean,
    fallbackFactory: () => Observable<RoomReservation | null>,
  ): Observable<RoomReservation | null> {
    const requestBody: BackendSecurityValidationRequest = { approved };

    const request$ = this.http
      .put<BackendReservationResponse>(buildApiUrl(`/api/v1/reservations/${id}/security-validation`), requestBody)
      .pipe(
        map((response) => this.mapRoomReservation(response)),
        tap((updated) => this.replaceRoomReservation(updated)),
      );

    return this.withFallback(request$, fallbackFactory);
  }

  private securityValidateEquipmentReservation(
    id: string,
    approved: boolean,
    fallbackFactory: () => Observable<EquipmentReservation | null>,
  ): Observable<EquipmentReservation | null> {
    const requestBody: BackendSecurityValidationRequest = { approved };

    const request$ = this.http
      .put<BackendReservationResponse>(buildApiUrl(`/api/v1/reservations/${id}/security-validation`), requestBody)
      .pipe(
        map((response) => this.mapEquipmentReservation(response)),
        tap((updated) => this.replaceEquipmentReservation(updated)),
      );

    return this.withFallback(request$, fallbackFactory);
  }

  private mapRoom(response: BackendRoomResponse): Room {
    return {
      id: response.id,
      name: response.name,
      description: `Salle ${response.name} - ${response.location}`,
      capacity: response.capacity,
      location: response.location,
      amenities: [],
      isActive: response.active,
      createdAt: this.toDate(response.createdAt),
    };
  }

  private mapEquipment(response: BackendEquipmentResponse): Equipment {
    const category = this.inferEquipmentCategory(response.name, response.description || '');
    const status = response.active ? 'AVAILABLE' : 'MAINTENANCE';

    return {
      id: response.id,
      name: response.name,
      description: response.description || '',
      category,
      serialNumber: response.serialNumber,
      status,
      location: 'Stock central',
      createdAt: this.toDate(response.createdAt),
    };
  }

  private mapRoomReservation(response: BackendReservationResponse): RoomReservation {
    const roomId = response.roomId ?? '';
    const roomName = this.roomsSubject.value.find((room) => room.id === roomId)?.name || 'Salle';

    return {
      id: response.id,
      roomId,
      roomName,
      userId: response.requesterUsername,
      userName: response.requesterUsername,
      title: response.purpose || 'Reservation de salle',
      purpose: response.purpose || '',
      startDate: this.toDate(response.startAt),
      endDate: this.toDate(response.endAt),
      attendeeCount: 1,
      status: this.toRoomReservationStatus(response.status),
      createdAt: this.toDate(response.createdAt),
      updatedAt: this.toDate(response.updatedAt),
    };
  }

  private mapEquipmentReservation(response: BackendReservationResponse): EquipmentReservation {
    const equipmentId = response.equipmentId ?? '';
    const equipmentName = this.equipmentSubject.value.find((item) => item.id === equipmentId)?.name || 'Equipement';

    return {
      id: response.id,
      equipmentId,
      equipmentName,
      userId: response.requesterUsername,
      userName: response.requesterUsername,
      purpose: response.purpose || '',
      startDate: this.toDate(response.startAt),
      endDate: this.toDate(response.endAt),
      status: this.toEquipmentReservationStatus(response.status),
      createdAt: this.toDate(response.createdAt),
      updatedAt: this.toDate(response.updatedAt),
    };
  }

  private toRoomReservationStatus(status: BackendReservationStatus): RoomReservation['status'] {
    if (status === 'APPROVED') {
      return 'APPROVED';
    }
    if (status === 'REJECTED') {
      return 'REJECTED';
    }
    return 'PENDING';
  }

  private toEquipmentReservationStatus(status: BackendReservationStatus): EquipmentReservation['status'] {
    if (status === 'APPROVED') {
      return 'APPROVED';
    }
    if (status === 'REJECTED') {
      return 'CANCELLED';
    }
    return 'PENDING';
  }

  private inferEquipmentCategory(name: string, description: string): Equipment['category'] {
    const text = `${name} ${description}`.toLowerCase();
    if (text.includes('projector') || text.includes('projecteur')) {
      return 'PROJECTOR';
    }
    if (text.includes('laptop') || text.includes('ordinateur')) {
      return 'LAPTOP';
    }
    if (text.includes('camera') || text.includes('cam')) {
      return 'CAMERA';
    }
    if (text.includes('micro')) {
      return 'MICROPHONE';
    }
    if (text.includes('screen') || text.includes('ecran')) {
      return 'SCREEN';
    }
    return 'OTHER';
  }

  private replaceRoom(updated: Room): void {
    const rooms = this.roomsSubject.value.map((room) => (room.id === updated.id ? updated : room));
    this.roomsSubject.next(rooms);
  }

  private replaceEquipment(updated: Equipment): void {
    const equipment = this.equipmentSubject.value.map((item) => (item.id === updated.id ? updated : item));
    this.equipmentSubject.next(equipment);
  }

  private replaceRoomReservation(updated: RoomReservation): void {
    const reservations = this.roomReservationsSubject.value;
    const index = reservations.findIndex((reservation) => reservation.id === updated.id);
    if (index < 0) {
      this.roomReservationsSubject.next([...reservations, updated]);
      return;
    }

    reservations[index] = updated;
    this.roomReservationsSubject.next([...reservations]);
  }

  private replaceEquipmentReservation(updated: EquipmentReservation): void {
    const reservations = this.equipmentReservationsSubject.value;
    const index = reservations.findIndex((reservation) => reservation.id === updated.id);
    if (index < 0) {
      this.equipmentReservationsSubject.next([...reservations, updated]);
      return;
    }

    reservations[index] = updated;
    this.equipmentReservationsSubject.next([...reservations]);
  }

  private checkRoomConflicts(roomId: string, startDate: Date, endDate: Date): RoomReservation[] {
    return this.roomReservationsSubject.value.filter((reservation) =>
      reservation.roomId === roomId &&
      (reservation.status === 'APPROVED' || reservation.status === 'PENDING') &&
      !(endDate <= reservation.startDate || startDate >= reservation.endDate),
    );
  }

  private checkBackendConflict(
    roomId: string | undefined,
    equipmentId: string | undefined,
    startAt: Date,
    endAt: Date,
  ): Observable<boolean> {
    if (!this.shouldUseBackendRequests() || !this.canCheckConflictsFromBackend()) {
      return of(false);
    }

    const params: Record<string, string> = {
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
    };

    if (roomId) {
      params['roomId'] = roomId;
    }
    if (equipmentId) {
      params['equipmentId'] = equipmentId;
    }

    return this.http
      .get<BackendConflictCheckResponse>(buildApiUrl('/api/v1/reservations/conflicts'), { params })
      .pipe(
        map((response) => !!response.conflict),
        catchError(() => of(false)),
      );
  }

  private canReadRoomInventoryFromBackend(): boolean {
    const role = this.authService.currentRole;
    return role === 'ADMIN'
      || role === 'EMPLOYEE'
      || role === 'MANAGER'
      || role === 'ROOM_MANAGER'
      || role === 'SECURITY_MANAGER'
      || role === 'DSN_DIRECTOR';
  }

  private canReadEquipmentInventoryFromBackend(): boolean {
    const role = this.authService.currentRole;
    return role === 'ADMIN'
      || role === 'EMPLOYEE'
      || role === 'MANAGER'
      || role === 'ROOM_MANAGER'
      || role === 'SECURITY_MANAGER'
      || role === 'DSN_DIRECTOR';
  }

  private canCheckConflictsFromBackend(): boolean {
    return this.authService.currentRole === 'SECURITY_MANAGER';
  }

  private shouldUseBackendRequests(): boolean {
    return this.authService.isAuthenticated();
  }

  private timeToString(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  private calculateAvailableSlots(occupiedSlots: { startTime: string; endTime: string }[]): { startTime: string; endTime: string }[] {
    const slots: Array<{ startTime: string; endTime: string }> = [];

    if (!occupiedSlots.some((slot) => slot.startTime < '12:00' && slot.endTime > '09:00')) {
      slots.push({ startTime: '09:00', endTime: '12:00' });
    }
    if (!occupiedSlots.some((slot) => slot.startTime < '17:00' && slot.endTime > '14:00')) {
      slots.push({ startTime: '14:00', endTime: '17:00' });
    }

    return slots;
  }

  private toDate(value?: string): Date {
    if (!value) {
      return new Date();
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  private withFallback<T>(request$: Observable<T>, fallbackFactory: () => Observable<T>): Observable<T> {
    if (this.shouldUseBackendRequests()) {
      return request$.pipe(
        catchError((error) => throwError(() => error)),
      );
    }

    return fallbackFactory();
  }

  private generateId(): string {
    return Math.random().toString(36).slice(2, 11);
  }
}
