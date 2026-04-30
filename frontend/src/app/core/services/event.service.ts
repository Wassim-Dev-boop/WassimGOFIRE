import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';
import { ApiPageResponse, buildApiUrl, extractPageContent } from '../config/backend-api.config';
import { Event, EventMode, EventStatus, EventFilter, EventParticipant, EventPhoto, ZoomMeetingCredentials } from '../models';

type BackendEventStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
type BackendEventMode = 'PRESENTIEL' | 'EN_LIGNE' | 'HYBRIDE';
type BackendEventType = 'REUNION' | 'FORMATION' | 'SEMINAIRE' | 'ATELIER' | 'CONFERENCE' | 'VISITE_PARTENAIRE' | 'AUTRE';

interface BackendEventResponse {
  id: string;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  location?: string;
  eventType?: BackendEventType;
  eventMode?: BackendEventMode;
  onlineEvent?: boolean;
  zoomMeetingNumber?: string;
  zoomPasscode?: string;
  onlineMeetingProvider?: string;
  onlineMeetingLink?: string;
  onlineMeetingId?: string;
  onlineMeetingPassword?: string;
  requestedBy: string;
  status: BackendEventStatus;
  workflowStep?: string;
  businessVersion?: number;
  referenceCode?: string;
  rejectionReason?: string;
  hasExternalPartners?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface BackendCreateEventRequest {
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  location?: string;
  eventType?: BackendEventType;
  eventMode?: BackendEventMode;
  onlineEvent?: boolean;
  zoomMeetingNumber?: string;
  zoomPasscode?: string;
  onlineMeetingProvider?: string;
  onlineMeetingLink?: string;
  onlineMeetingId?: string;
  onlineMeetingPassword?: string;
}

type BackendUpdateEventRequest = BackendCreateEventRequest;

interface BackendDecisionRequest {
  approved: boolean;
  decisionComment?: string;
  rejectionReason?: string;
}

interface BackendEventPhotoResponse {
  id: string;
  eventId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
}

export interface EventQueryOptions {
  page?: number;
  size?: number;
  sort?: string;
  search?: string;
  status?: EventStatus;
  eventType?: Event['type'];
  eventMode?: EventMode;
  workflowStep?: Event['workflowStep'];
  requestedBy?: string;
}

export interface EventPageState {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

type BackendZoomSignatureResponse = ZoomMeetingCredentials;

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private eventsSubject = new BehaviorSubject<Event[]>([]);
  public events$ = this.eventsSubject.asObservable();
  private eventPageStateSubject = new BehaviorSubject<EventPageState>({
    page: 0,
    size: 500,
    totalElements: 0,
    totalPages: 0,
  });
  public eventPageState$ = this.eventPageStateSubject.asObservable();

  constructor(private http: HttpClient) {}

  getEvents(options: EventQueryOptions = {}): Observable<Event[]> {
    const params = new HttpParams()
      .set('page', String(options.page ?? 0))
      .set('size', String(options.size ?? 500))
      .set('sort', options.sort || 'startAt,desc');

    let queryParams = params;

    if (options.search?.trim()) {
      queryParams = queryParams.set('search', options.search.trim());
    }
    if (options.status) {
      queryParams = queryParams.set('status', this.toBackendStatus(options.status));
    }
    if (options.eventType) {
      queryParams = queryParams.set('eventType', this.toBackendEventType(options.eventType));
    }
    if (options.eventMode) {
      queryParams = queryParams.set('eventMode', options.eventMode);
    }
    if (options.workflowStep) {
      queryParams = queryParams.set('workflowStep', options.workflowStep);
    }
    if (options.requestedBy?.trim()) {
      queryParams = queryParams.set('requestedBy', options.requestedBy.trim());
    }

    const request$ = this.http
      .get<ApiPageResponse<BackendEventResponse>>(buildApiUrl('/api/v1/events'), { params: queryParams })
      .pipe(
        map((response) => {
          this.eventPageStateSubject.next({
            page: response.page ?? options.page ?? 0,
            size: response.size ?? options.size ?? 500,
            totalElements: response.totalElements ?? 0,
            totalPages: response.totalPages ?? 0,
          });
          return extractPageContent(response).map((item) => this.mapEvent(item));
        }),
        tap((events) => this.eventsSubject.next(events)),
      );

    return this.withFallback(request$, () => of(this.eventsSubject.value));
  }

  getEventById(id: string): Observable<Event | undefined> {
    const request$ = this.http
      .get<BackendEventResponse>(buildApiUrl(`/api/v1/events/${id}`))
      .pipe(map((response) => this.mapEvent(response)));

    return this.withFallback(request$, () => of(this.eventsSubject.value.find((event) => event.id === id)));
  }

  searchEvents(filter: EventFilter): Observable<Event[]> {
    return this.getEvents({
      search: filter.searchTerm,
      status: filter.status,
      eventType: (filter.type as Event['type']) || undefined,
      requestedBy: filter.organiserId,
      sort: 'startAt,desc',
      page: 0,
      size: 200,
    });
  }

  createEvent(event: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>): Observable<Event> {
    const eventMode = this.toBackendEventMode(event);
    const meetingId = event.zoomMeetingNumber?.trim() || undefined;
    const meetingPassword = event.zoomPasscode?.trim() || undefined;
    const providedMeetingUrl = event.onlineMeetingUrl?.trim();
    const meetingUrl = providedMeetingUrl || (eventMode === 'PRESENTIEL' || !meetingId ? undefined : `https://zoom.us/j/${meetingId}`);
    const meetingProvider = event.onlineMeetingProvider?.trim() || (eventMode === 'PRESENTIEL' ? undefined : 'Zoom');

    const payload: BackendCreateEventRequest = {
      title: event.title,
      description: event.description,
      startAt: event.startDate.toISOString(),
      endAt: event.endDate.toISOString(),
      location: event.location,
      eventType: this.toBackendEventType(event.type),
      eventMode,
      onlineEvent: eventMode !== 'PRESENTIEL',
      zoomMeetingNumber: meetingId,
      zoomPasscode: meetingPassword,
      onlineMeetingProvider: meetingProvider,
      onlineMeetingLink: meetingUrl,
      onlineMeetingId: meetingId,
      onlineMeetingPassword: meetingPassword,
    };

    const request$ = this.http
      .post<BackendEventResponse>(buildApiUrl('/api/v1/events'), payload)
      .pipe(
        switchMap((createdDraft) =>
          this.http
            .post<BackendEventResponse>(buildApiUrl(`/api/v1/events/${createdDraft.id}/submit`), { comment: null })
            .pipe(
              map((submitted) => this.mapEvent(submitted)),
              catchError(() => of(this.mapEvent(createdDraft))),
            ),
        ),
        tap((created) => this.eventsSubject.next([...this.eventsSubject.value, created])),
      );

    return this.withFallback(request$, () => {
      const created: Event = {
        ...event,
        id: this.generateId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.eventsSubject.next([...this.eventsSubject.value, created]);
      return of(created);
    });
  }

  updateEvent(id: string, updates: Partial<Event>): Observable<Event | null> {
    const current = this.eventsSubject.value.find((event) => event.id === id);
    if (!current) {
      return of(null);
    }

    const mergedDraft: Event = {
      ...current,
      ...updates,
      updatedAt: new Date(),
    };
    const eventMode = this.toBackendEventMode(mergedDraft);
    const meetingId = mergedDraft.zoomMeetingNumber?.trim() || undefined;
    const meetingPassword = mergedDraft.zoomPasscode?.trim() || undefined;
    const providedMeetingUrl = mergedDraft.onlineMeetingUrl?.trim();
    const meetingUrl = providedMeetingUrl || (eventMode === 'PRESENTIEL' || !meetingId ? undefined : `https://zoom.us/j/${meetingId}`);
    const meetingProvider = mergedDraft.onlineMeetingProvider?.trim() || (eventMode === 'PRESENTIEL' ? undefined : 'Zoom');

    const payload: BackendUpdateEventRequest = {
      title: mergedDraft.title,
      description: mergedDraft.description,
      startAt: mergedDraft.startDate.toISOString(),
      endAt: mergedDraft.endDate.toISOString(),
      location: mergedDraft.location,
      eventType: this.toBackendEventType(mergedDraft.type),
      eventMode,
      onlineEvent: eventMode !== 'PRESENTIEL',
      zoomMeetingNumber: meetingId,
      zoomPasscode: meetingPassword,
      onlineMeetingProvider: meetingProvider,
      onlineMeetingLink: meetingUrl,
      onlineMeetingId: meetingId,
      onlineMeetingPassword: meetingPassword,
    };

    const request$ = this.http
      .put<BackendEventResponse>(buildApiUrl(`/api/v1/events/${id}`), payload)
      .pipe(
        switchMap((updatedDraft) => {
          const shouldResubmit = updates.status === EventStatus.DRAFT && current.status === EventStatus.CANCELLED;
          if (!shouldResubmit) {
            return of(this.mapEvent(updatedDraft));
          }

          return this.http
            .post<BackendEventResponse>(buildApiUrl(`/api/v1/events/${id}/resubmit`), { comment: 'Resoumission apres correction' })
            .pipe(
              map((resubmitted) => this.mapEvent(resubmitted)),
              catchError(() => of(this.mapEvent(updatedDraft))),
            );
        }),
        tap((updated) => this.replaceEvent(updated)),
      );

    return this.withFallback(request$, () => {
      this.replaceEvent(mergedDraft);
      return of(mergedDraft);
    });
  }

  changeEventStatus(id: string, status: EventStatus): Observable<Event | null> {
    if (status !== EventStatus.PUBLISHED && status !== EventStatus.CANCELLED) {
      return this.updateEvent(id, { status });
    }

    const payload: BackendDecisionRequest = {
      approved: status === EventStatus.PUBLISHED,
      decisionComment: status === EventStatus.CANCELLED ? 'Refus valide depuis le workflow frontend' : 'Validation effectuee depuis le workflow frontend',
      rejectionReason: status === EventStatus.CANCELLED ? 'Refus valide depuis le workflow frontend' : undefined,
    };

    const request$ = this.http
      .put<BackendEventResponse>(buildApiUrl(`/api/v1/events/${id}/decision`), payload)
      .pipe(
        map((response) => this.mapEvent(response)),
        tap((updated) => this.replaceEvent(updated)),
      );

    return this.withFallback(request$, () => {
      const current = this.eventsSubject.value.find((event) => event.id === id);
      if (!current) {
        return of(null);
      }

      const updated: Event = {
        ...current,
        status,
        updatedAt: new Date(),
      };
      this.replaceEvent(updated);
      return of(updated);
    });
  }

  submitEvent(id: string, comment?: string): Observable<Event | null> {
    const request$ = this.http
      .post<BackendEventResponse>(buildApiUrl(`/api/v1/events/${id}/submit`), { comment: comment || null })
      .pipe(
        map((response) => this.mapEvent(response)),
        tap((updated) => this.replaceEvent(updated)),
      );

    return this.withFallback(request$, () => {
      const current = this.eventsSubject.value.find((event) => event.id === id) || null;
      if (!current) {
        return of(null);
      }
      return of(current);
    });
  }

  getZoomMeetingCredentials(eventId: string): Observable<ZoomMeetingCredentials> {
    return this.http
      .post<BackendZoomSignatureResponse>(buildApiUrl(`/api/v1/events/${eventId}/zoom-signature`), {})
      .pipe(
        map((response) => ({
          sdkKey: response.sdkKey,
          signature: response.signature,
          meetingNumber: response.meetingNumber,
          passcode: response.passcode,
          userName: response.userName,
          role: response.role,
          fallbackWebUrl: response.fallbackWebUrl || '',
          sdkConfigured: !!response.sdkConfigured,
        })),
        catchError((error) => {
          const backendMessage =
            error?.error?.message ||
            error?.error?.error ||
            error?.message ||
            'Impossible de recuperer les identifiants Zoom.';
          return throwError(() => new Error(backendMessage));
        }),
      );
  }

  deleteEvent(id: string): Observable<boolean> {
    this.eventsSubject.next(this.eventsSubject.value.filter((event) => event.id !== id));
    return of(true);
  }

  listEventPhotos(eventId: string): Observable<EventPhoto[]> {
    return this.http
      .get<BackendEventPhotoResponse[]>(buildApiUrl(`/api/v1/events/${eventId}/photos`))
      .pipe(map((items) => (Array.isArray(items) ? items.map((item) => this.mapEventPhoto(item)) : [])));
  }

  uploadEventPhoto(eventId: string, file: File): Observable<EventPhoto> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http
      .post<BackendEventPhotoResponse>(buildApiUrl(`/api/v1/events/${eventId}/photos`), formData)
      .pipe(map((item) => this.mapEventPhoto(item)));
  }

  getEventPhotoBlob(eventId: string, photoId: string): Observable<Blob> {
    return this.http.get(buildApiUrl(`/api/v1/events/${eventId}/photos/${photoId}/download`), {
      responseType: 'blob',
    });
  }

  downloadEventPhoto(eventId: string, photo: Pick<EventPhoto, 'id' | 'fileName'>): Observable<boolean> {
    return this.http
      .get(buildApiUrl(`/api/v1/events/${eventId}/photos/${photo.id}/download`), {
        observe: 'response',
        responseType: 'blob',
      })
      .pipe(
        map((response) => {
          const blob = response.body;
          if (!blob) {
            throw new Error('Photo introuvable');
          }
          const filename = this.resolveFileName(
            response.headers.get('content-disposition'),
            photo.fileName || `photo-${photo.id}.jpg`,
          );
          this.triggerFileDownload(blob, filename);
          return true;
        }),
      );
  }

  archiveEventPhoto(eventId: string, photoId: string): Observable<void> {
    return this.http.delete<void>(buildApiUrl(`/api/v1/events/${eventId}/photos/${photoId}`));
  }

  addParticipant(eventId: string, userId: string, userName: string, userEmail: string): Observable<Event | null> {
    const events = this.eventsSubject.value;
    const event = events.find((item) => item.id === eventId);
    if (!event) {
      return of(null);
    }

    const participant: EventParticipant = {
      id: this.generateId(),
      userId,
      userName,
      userEmail,
      status: 'ATTENDING',
    };

    event.participants.push(participant);
    event.updatedAt = new Date();
    this.eventsSubject.next([...events]);
    return of(event);
  }

  removeParticipant(eventId: string, participantId: string): Observable<Event | null> {
    const events = this.eventsSubject.value;
    const event = events.find((item) => item.id === eventId);
    if (!event) {
      return of(null);
    }

    event.participants = event.participants.filter((participant) => participant.id !== participantId);
    event.updatedAt = new Date();
    this.eventsSubject.next([...events]);
    return of(event);
  }

  getEventParticipants(eventId: string): Observable<EventParticipant[]> {
    const event = this.eventsSubject.value.find((item) => item.id === eventId);
    return of(event?.participants || []);
  }

  updateParticipantStatus(
    eventId: string,
    participantId: string,
    status: 'ATTENDING' | 'NOT_ATTENDING' | 'MAYBE',
  ): Observable<EventParticipant | null> {
    const event = this.eventsSubject.value.find((item) => item.id === eventId);
    if (!event) {
      return of(null);
    }

    const participant = event.participants.find((item) => item.id === participantId);
    if (!participant) {
      return of(null);
    }

    participant.status = status;
    participant.joinedAt = status === 'ATTENDING' ? new Date() : undefined;
    event.updatedAt = new Date();
    this.eventsSubject.next([...this.eventsSubject.value]);
    return of(participant);
  }

  private mapEvent(response: BackendEventResponse): Event {
    const startDate = this.toDate(response.startAt);
    const endDate = this.toDate(response.endAt);
    const type = this.fromBackendEventType(response.eventType) ?? this.inferType(response.title, response.description || '');
    const eventMode = this.mapBackendEventMode(response.eventMode, response.onlineEvent);
    const onlineEvent = eventMode !== 'PRESENTIEL';

    return {
      id: response.id,
      title: response.title,
      description: response.description || '',
      startDate,
      endDate,
      location: response.location || 'Lieu a confirmer',
      eventMode,
      onlineEvent,
      onlineMeetingUrl: response.onlineMeetingLink || undefined,
      onlineMeetingProvider: response.onlineMeetingProvider || undefined,
      zoomMeetingNumber: response.onlineMeetingId || response.zoomMeetingNumber || undefined,
      zoomPasscode: response.onlineMeetingPassword || response.zoomPasscode || undefined,
      organiserId: response.requestedBy,
      organiserName: response.requestedBy,
      status: this.mapStatus(response.status),
      workflowStep: this.mapWorkflowStep(response.workflowStep),
      businessVersion: response.businessVersion ?? 1,
      referenceCode: response.referenceCode || undefined,
      rejectionReason: response.rejectionReason || undefined,
      hasExternalPartners: !!response.hasExternalPartners,
      participants: [],
      maxParticipants: 50,
      createdAt: this.toDate(response.createdAt, startDate),
      updatedAt: this.toDate(response.updatedAt, startDate),
      type,
      category: 'General',
      visualColor: this.typeToVisualColor(type),
    };
  }

  private mapStatus(status: BackendEventStatus): EventStatus {
    if (status === 'DRAFT') {
      return EventStatus.DRAFT;
    }
    if (status === 'PENDING') {
      return EventStatus.SUBMITTED;
    }
    if (status === 'APPROVED') {
      return EventStatus.PUBLISHED;
    }
    if (status === 'REJECTED') {
      return EventStatus.CANCELLED;
    }
    return EventStatus.DRAFT;
  }

  private toBackendStatus(status: EventStatus): BackendEventStatus {
    if (status === EventStatus.DRAFT) {
      return 'DRAFT';
    }
    if (status === EventStatus.SUBMITTED) {
      return 'PENDING';
    }
    if (status === EventStatus.PUBLISHED) {
      return 'APPROVED';
    }
    if (status === EventStatus.CANCELLED) {
      return 'REJECTED';
    }
    return 'APPROVED';
  }

  private mapWorkflowStep(step?: string): Event['workflowStep'] {
    if (
      step === 'BROUILLON'
      || step === 'VALIDATION_MANAGER'
      || step === 'VALIDATION_SECURITE'
      || step === 'VALIDATION_DSN'
      || step === 'TERMINE'
      || step === 'REFUSE'
    ) {
      return step;
    }
    return undefined;
  }

  private mapBackendEventMode(mode: BackendEventMode | undefined, onlineEvent?: boolean): EventMode {
    if (mode === 'PRESENTIEL' || mode === 'EN_LIGNE' || mode === 'HYBRIDE') {
      return mode;
    }
    return onlineEvent ? 'EN_LIGNE' : 'PRESENTIEL';
  }

  private toBackendEventMode(event: Pick<Event, 'eventMode' | 'onlineEvent'>): BackendEventMode {
    if (event.eventMode === 'PRESENTIEL' || event.eventMode === 'EN_LIGNE' || event.eventMode === 'HYBRIDE') {
      return event.eventMode;
    }
    return event.onlineEvent ? 'EN_LIGNE' : 'PRESENTIEL';
  }

  private toBackendEventType(type: Event['type']): BackendEventType {
    if (type === 'CONFERENCE') {
      return 'CONFERENCE';
    }
    if (type === 'TRAINING') {
      return 'FORMATION';
    }
    if (type === 'WORKSHOP') {
      return 'ATELIER';
    }
    if (type === 'MEETING') {
      return 'REUNION';
    }
    return 'AUTRE';
  }

  private fromBackendEventType(type?: BackendEventType): Event['type'] | null {
    if (!type) {
      return null;
    }
    if (type === 'CONFERENCE') {
      return 'CONFERENCE';
    }
    if (type === 'FORMATION') {
      return 'TRAINING';
    }
    if (type === 'ATELIER') {
      return 'WORKSHOP';
    }
    if (type === 'REUNION') {
      return 'MEETING';
    }
    return 'OTHER';
  }

  private inferType(title: string, description: string): Event['type'] {
    const text = `${title} ${description}`.toLowerCase();
    if (text.includes('conference')) {
      return 'CONFERENCE';
    }
    if (text.includes('training') || text.includes('formation')) {
      return 'TRAINING';
    }
    if (text.includes('workshop') || text.includes('atelier')) {
      return 'WORKSHOP';
    }
    if (text.includes('meeting') || text.includes('reunion')) {
      return 'MEETING';
    }
    return 'OTHER';
  }

  private typeToVisualColor(type: Event['type']): Event['visualColor'] {
    if (type === 'WORKSHOP') {
      return 'Danger';
    }
    if (type === 'TRAINING') {
      return 'Success';
    }
    if (type === 'CONFERENCE') {
      return 'Primary';
    }
    return 'Warning';
  }

  private replaceEvent(updated: Event): void {
    const events = this.eventsSubject.value.map((event) => (event.id === updated.id ? updated : event));
    this.eventsSubject.next(events);
  }

  private toDate(value?: string, fallback = new Date()): Date {
    if (!value) {
      return fallback;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
  }

  private mapEventPhoto(item: BackendEventPhotoResponse): EventPhoto {
    return {
      id: item.id,
      eventId: item.eventId,
      fileName: item.fileName,
      contentType: item.contentType,
      fileSize: item.fileSize,
      uploadedBy: item.uploadedBy,
      uploadedAt: this.toDate(item.uploadedAt),
    };
  }

  private withFallback<T>(request$: Observable<T>, fallbackFactory: () => Observable<T>): Observable<T> {
    return request$.pipe(
      catchError((error) => throwError(() => error)),
    );
  }

  downloadLatestOfficialDocument(eventId: string): Observable<boolean> {
    return this.http
      .get(buildApiUrl(`/api/v1/events/${eventId}/documents/latest/download`), {
        observe: 'response',
        responseType: 'blob',
      })
      .pipe(
        map((response) => {
          const blob = response.body;
          if (!blob) {
            throw new Error('Document PDF indisponible.');
          }

          const filename = this.resolveFileName(
            response.headers.get('content-disposition'),
            `evenement-${eventId}.pdf`,
          );
          this.triggerFileDownload(blob, filename);
          return true;
        }),
      );
  }

  private generateId(): string {
    return Math.random().toString(36).slice(2, 11);
  }

  private resolveFileName(contentDisposition: string | null, fallback: string): string {
    if (!contentDisposition) {
      return fallback;
    }

    const quotedMatch = /filename=\"([^\"]+)\"/i.exec(contentDisposition);
    if (quotedMatch?.[1]) {
      return quotedMatch[1];
    }

    const simpleMatch = /filename=([^;]+)/i.exec(contentDisposition);
    if (simpleMatch?.[1]) {
      return simpleMatch[1].trim();
    }

    return fallback;
  }

  private triggerFileDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}
