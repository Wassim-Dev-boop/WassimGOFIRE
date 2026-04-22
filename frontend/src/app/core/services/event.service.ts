import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { ApiPageResponse, buildApiUrl, extractPageContent } from '../config/backend-api.config';
import { Event, EventStatus, EventFilter, EventParticipant, ZoomMeetingCredentials } from '../models';

type BackendEventStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface BackendEventResponse {
  id: string;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  location?: string;
  onlineEvent?: boolean;
  zoomMeetingNumber?: string;
  zoomPasscode?: string;
  requestedBy: string;
  status: BackendEventStatus;
  createdAt?: string;
  updatedAt?: string;
}

interface BackendCreateEventRequest {
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  location?: string;
  onlineEvent?: boolean;
  zoomMeetingNumber?: string;
  zoomPasscode?: string;
}

interface BackendDecisionRequest {
  approved: boolean;
  decisionComment?: string;
}

type BackendZoomSignatureResponse = ZoomMeetingCredentials;

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private eventsSubject = new BehaviorSubject<Event[]>([]);
  public events$ = this.eventsSubject.asObservable();

  constructor(private http: HttpClient) {}

  getEvents(): Observable<Event[]> {
    const params = new HttpParams()
      .set('page', '0')
      .set('size', '500')
      .set('sort', 'startAt,desc');

    const request$ = this.http
      .get<ApiPageResponse<BackendEventResponse>>(buildApiUrl('/api/v1/events'), { params })
      .pipe(
        map((response) => extractPageContent(response).map((item) => this.mapEvent(item))),
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
    let results = [...this.eventsSubject.value];

    if (filter.searchTerm) {
      const term = filter.searchTerm.toLowerCase();
      results = results.filter((event) =>
        event.title.toLowerCase().includes(term) ||
        (event.description || '').toLowerCase().includes(term),
      );
    }

    if (filter.status) {
      results = results.filter((event) => event.status === filter.status);
    }

    if (filter.type) {
      results = results.filter((event) => event.type === filter.type);
    }

    if (filter.startDate && filter.endDate) {
      results = results.filter((event) => event.startDate >= filter.startDate! && event.startDate <= filter.endDate!);
    }

    if (filter.organiserId) {
      results = results.filter((event) => event.organiserId === filter.organiserId);
    }

    return of(results);
  }

  createEvent(event: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>): Observable<Event> {
    const payload: BackendCreateEventRequest = {
      title: event.title,
      description: event.description,
      startAt: event.startDate.toISOString(),
      endAt: event.endDate.toISOString(),
      location: event.location,
      onlineEvent: !!event.onlineEvent,
      zoomMeetingNumber: event.zoomMeetingNumber || undefined,
      zoomPasscode: event.zoomPasscode || undefined,
    };

    const request$ = this.http
      .post<BackendEventResponse>(buildApiUrl('/api/v1/events'), payload)
      .pipe(
        map((response) => this.mapEvent(response)),
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

    // Backend currently exposes only status decision endpoint.
    if (updates.status && updates.status !== current.status) {
      return this.changeEventStatus(id, updates.status).pipe(
        map((statusUpdated) => {
          if (!statusUpdated) {
            return null;
          }

          const merged: Event = {
            ...statusUpdated,
            ...updates,
            id: statusUpdated.id,
            updatedAt: new Date(),
          };
          this.replaceEvent(merged);
          return merged;
        }),
      );
    }

    const updated: Event = {
      ...current,
      ...updates,
      updatedAt: new Date(),
    };
    this.replaceEvent(updated);
    return of(updated);
  }

  changeEventStatus(id: string, status: EventStatus): Observable<Event | null> {
    if (status !== EventStatus.PUBLISHED && status !== EventStatus.CANCELLED) {
      return this.updateEvent(id, { status });
    }

    const payload: BackendDecisionRequest = {
      approved: status === EventStatus.PUBLISHED,
      decisionComment: status === EventStatus.CANCELLED ? 'Declined from frontend workflow' : 'Approved from frontend workflow',
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

  getZoomMeetingCredentials(eventId: string): Observable<ZoomMeetingCredentials | null> {
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
        })),
        catchError(() => of(null)),
      );
  }

  deleteEvent(id: string): Observable<boolean> {
    this.eventsSubject.next(this.eventsSubject.value.filter((event) => event.id !== id));
    return of(true);
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
    const type = this.inferType(response.title, response.description || '');

    return {
      id: response.id,
      title: response.title,
      description: response.description || '',
      startDate,
      endDate,
      location: response.location || 'Lieu a confirmer',
      onlineEvent: !!response.onlineEvent,
      zoomMeetingNumber: response.zoomMeetingNumber || undefined,
      zoomPasscode: response.zoomPasscode || undefined,
      organiserId: response.requestedBy,
      organiserName: response.requestedBy,
      status: this.mapStatus(response.status),
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
    if (status === 'APPROVED') {
      return EventStatus.PUBLISHED;
    }
    if (status === 'REJECTED') {
      return EventStatus.CANCELLED;
    }
    return EventStatus.DRAFT;
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

  private withFallback<T>(request$: Observable<T>, fallbackFactory: () => Observable<T>): Observable<T> {
    return request$.pipe(
      catchError((error) => throwError(() => error)),
    );
  }

  private generateId(): string {
    return Math.random().toString(36).slice(2, 11);
  }
}
