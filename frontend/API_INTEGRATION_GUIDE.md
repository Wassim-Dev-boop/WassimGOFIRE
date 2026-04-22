# Enterprise Dashboard - API Integration Guide

## 🔌 Backend API Integration

This guide explains how to connect the enterprise dashboard to your backend API, replacing the mock data with real data from your server.

---

## 📋 Overview

### Current State (Mock Data)
- All services use in-memory mock data
- RxJS BehaviorSubjects act as data stores
- No API calls made
- Perfect for UI testing and development

### Target State (API Integration)
- Services make HTTP requests using `HttpClient`
- Real data flows from backend
- Error handling and retry logic
- Loading states and spinners

---

## 🛠️ Integration Steps

### Step 1: Import HttpClientModule

In your `app.config.ts`:

```typescript
import { HttpClientModule } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    // ... other providers
    provideHttpClient(),
    // OR for legacy projects:
    importProvidedHttpClientFrom(HttpClientModule)
  ],
};
```

### Step 2: Update Service Methods

Each service method needs to be updated from mock to API calls. Here's the pattern:

**Before (Mock Data):**
```typescript
getDocuments(): Observable<Document[]> {
  return this.documents$.asObservable();
}
```

**After (Real API):**
```typescript
getDocuments(): Observable<Document[]> {
  return this.http.get<Document[]>(`${this.apiUrl}/documents`)
    .pipe(
      tap(documents => this.documents$.next(documents)),
      catchError(error => {
        console.error('Error fetching documents:', error);
        return of([]);
      })
    );
}
```

---

## 🗂️ Service Migration Guide

### DocumentService

**Configuration:**
```typescript
export class DocumentService {
  private apiUrl = 'https://api.company.com/api/v1/documents';
  
  constructor(private http: HttpClient) {}
```

**Methods to Update:**

```typescript
// GET all documents
getDocuments(): Observable<Document[]> {
  return this.http.get<Document[]>(`${this.apiUrl}`)
    .pipe(
      tap(documents => this.documents$.next(documents)),
      catchError(this.handleError)
    );
}

// GET single document
getDocumentById(id: string): Observable<Document> {
  return this.http.get<Document>(`${this.apiUrl}/${id}`)
    .pipe(
      catchError(this.handleError)
    );
}

// POST new document
uploadDocument(document: Document): Observable<Document> {
  const formData = new FormData();
  // Append form fields
  formData.append('name', document.name);
  formData.append('description', document.description);
  
  return this.http.post<Document>(`${this.apiUrl}`, formData)
    .pipe(
      tap(doc => {
        const current = this.documents$.value;
        this.documents$.next([...current, doc]);
      }),
      catchError(this.handleError)
    );
}

// PUT update document
updateDocument(id: string, updates: Partial<Document>): Observable<Document> {
  return this.http.put<Document>(`${this.apiUrl}/${id}`, updates)
    .pipe(
      tap(doc => {
        const current = this.documents$.value;
        const index = current.findIndex(d => d.id === id);
        current[index] = doc;
        this.documents$.next([...current]);
      }),
      catchError(this.handleError)
    );
}

// DELETE document
deleteDocument(id: string): Observable<boolean> {
  return this.http.delete(`${this.apiUrl}/${id}`)
    .pipe(
      tap(() => {
        const current = this.documents$.value;
        this.documents$.next(current.filter(d => d.id !== id));
      }),
      map(() => true),
      catchError(this.handleError)
    );
}

// SEARCH documents
searchDocuments(filter: DocumentSearchFilter): Observable<Document[]> {
  let params = new HttpParams();
  
  if (filter.searchTerm) params = params.set('search', filter.searchTerm);
  if (filter.categoryId) params = params.set('category', filter.categoryId);
  if (filter.author) params = params.set('author', filter.author);
  if (filter.fromDate) params = params.set('from_date', filter.fromDate.toISOString());
  if (filter.toDate) params = params.set('to_date', filter.toDate.toISOString());
  if (filter.tags?.length) params = params.set('tags', filter.tags.join(','));
  
  return this.http.get<Document[]>(`${this.apiUrl}/search`, { params })
    .pipe(
      catchError(this.handleError)
    );
}
```

### EventService

```typescript
export class EventService {
  private apiUrl = 'https://api.company.com/api/v1/events';
  
  constructor(private http: HttpClient) {}

  getEvents(): Observable<Event[]> {
    return this.http.get<Event[]>(`${this.apiUrl}`)
      .pipe(
        tap(events => this.events$.next(events)),
        catchError(this.handleError)
      );
  }

  createEvent(event: Event): Observable<Event> {
    return this.http.post<Event>(`${this.apiUrl}`, event)
      .pipe(
        tap(newEvent => {
          const current = this.events$.value;
          this.events$.next([...current, newEvent]);
        }),
        catchError(this.handleError)
      );
  }

  updateEvent(id: string, updates: Partial<Event>): Observable<Event> {
    return this.http.put<Event>(`${this.apiUrl}/${id}`, updates)
      .pipe(
        tap(updatedEvent => {
          const current = this.events$.value;
          const index = current.findIndex(e => e.id === id);
          current[index] = updatedEvent;
          this.events$.next([...current]);
        }),
        catchError(this.handleError)
      );
  }

  changeEventStatus(id: string, status: EventStatus): Observable<Event> {
    return this.http.patch<Event>(
      `${this.apiUrl}/${id}/status`,
      { status }
    ).pipe(
      tap(event => this.updateEvent(event.id, event)),
      catchError(this.handleError)
    );
  }

  addParticipant(eventId: string, userId: string, userName: string, userEmail: string): Observable<Event> {
    return this.http.post<Event>(
      `${this.apiUrl}/${eventId}/participants`,
      { userId, userName, userEmail }
    ).pipe(
      catchError(this.handleError)
    );
  }
}
```

### ReservationService

```typescript
export class ReservationService {
  private apiUrl = 'https://api.company.com/api/v1/reservations';
  
  constructor(private http: HttpClient) {}

  // ROOMS
  getRooms(): Observable<Room[]> {
    return this.http.get<Room[]>(`${this.apiUrl}/rooms`)
      .pipe(
        tap(rooms => this.rooms$.next(rooms)),
        catchError(this.handleError)
      );
  }

  bookRoom(reservation: RoomReservation): Observable<RoomReservation> {
    return this.http.post<RoomReservation>(
      `${this.apiUrl}/rooms/book`,
      reservation
    ).pipe(
      tap(booked => {
        const current = this.roomReservations$.value;
        this.roomReservations$.next([...current, booked]);
      }),
      catchError(this.handleError)
    );
  }

  checkRoomConflicts(roomId: string, startDate: Date, endDate: Date): Observable<RoomReservation[]> {
    const params = new HttpParams()
      .set('room_id', roomId)
      .set('start_date', startDate.toISOString())
      .set('end_date', endDate.toISOString());
    
    return this.http.get<RoomReservation[]>(
      `${this.apiUrl}/rooms/conflicts`,
      { params }
    ).pipe(
      catchError(this.handleError)
    );
  }

  approveRoomReservation(id: string, approvedBy: string): Observable<RoomReservation> {
    return this.http.patch<RoomReservation>(
      `${this.apiUrl}/rooms/${id}/approve`,
      { approvedBy }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // EQUIPMENT
  getEquipment(): Observable<Equipment[]> {
    return this.http.get<Equipment[]>(`${this.apiUrl}/equipment`)
      .pipe(
        tap(equipment => this.equipment$.next(equipment)),
        catchError(this.handleError)
      );
  }

  reserveEquipment(reservation: EquipmentReservation): Observable<EquipmentReservation> {
    return this.http.post<EquipmentReservation>(
      `${this.apiUrl}/equipment/reserve`,
      reservation
    ).pipe(
      tap(reserved => {
        const current = this.equipmentReservations$.value;
        this.equipmentReservations$.next([...current, reserved]);
      }),
      catchError(this.handleError)
    );
  }

  pickupEquipment(reservationId: string): Observable<EquipmentReservation> {
    return this.http.patch<EquipmentReservation>(
      `${this.apiUrl}/equipment/${reservationId}/pickup`,
      {}
    ).pipe(
      catchError(this.handleError)
    );
  }

  returnEquipment(reservationId: string): Observable<EquipmentReservation> {
    return this.http.patch<EquipmentReservation>(
      `${this.apiUrl}/equipment/${reservationId}/return`,
      {}
    ).pipe(
      catchError(this.handleError)
    );
  }
}
```

### InterventionService

```typescript
export class InterventionService {
  private apiUrl = 'https://api.company.com/api/v1/interventions';
  
  constructor(private http: HttpClient) {}

  getInterventions(): Observable<Intervention[]> {
    return this.http.get<Intervention[]>(`${this.apiUrl}`)
      .pipe(
        tap(interventions => this.interventions$.next(interventions)),
        catchError(this.handleError)
      );
  }

  createIntervention(intervention: Intervention): Observable<Intervention> {
    return this.http.post<Intervention>(`${this.apiUrl}`, intervention)
      .pipe(
        tap(created => {
          const current = this.interventions$.value;
          this.interventions$.next([...current, created]);
        }),
        catchError(this.handleError)
      );
  }

  assignIntervention(interventionId: string, technicianId: string, technicianName: string): Observable<Intervention> {
    return this.http.patch<Intervention>(
      `${this.apiUrl}/${interventionId}/assign`,
      { technicianId, technicianName }
    ).pipe(
      catchError(this.handleError)
    );
  }

  completeIntervention(interventionId: string, resolution: string, satisfactionRating?: number): Observable<Intervention> {
    return this.http.patch<Intervention>(
      `${this.apiUrl}/${interventionId}/complete`,
      { resolution, satisfactionRating }
    ).pipe(
      catchError(this.handleError)
    );
  }

  closeIntervention(interventionId: string): Observable<Intervention> {
    return this.http.patch<Intervention>(
      `${this.apiUrl}/${interventionId}/close`,
      {}
    ).pipe(
      catchError(this.handleError)
    );
  }

  deleteIntervention(id: string): Observable<boolean> {
    return this.http.delete(`${this.apiUrl}/${id}`)
      .pipe(
        tap(() => {
          const current = this.interventions$.value;
          this.interventions$.next(current.filter(i => i.id !== id));
        }),
        map(() => true),
        catchError(this.handleError)
      );
  }
}
```

### NotificationService

```typescript
export class NotificationService {
  private apiUrl = 'https://api.company.com/api/v1/notifications';
  private eventSource: EventSource | null = null;
  
  constructor(private http: HttpClient) {}

  getNotifications(userId?: string): Observable<Notification[]> {
    let url = `${this.apiUrl}`;
    if (userId) url += `?user_id=${userId}`;
    
    return this.http.get<Notification[]>(url)
      .pipe(
        tap(notifications => this.notifications$.next(notifications)),
        catchError(this.handleError)
      );
  }

  markAsRead(notificationId: string): Observable<Notification> {
    return this.http.patch<Notification>(
      `${this.apiUrl}/${notificationId}/read`,
      {}
    ).pipe(
      tap(notification => {
        const current = this.notifications$.value;
        const index = current.findIndex(n => n.id === notificationId);
        current[index] = notification;
        this.notifications$.next([...current]);
        this.updateUnreadCount();
      }),
      catchError(this.handleError)
    );
  }

  markAllAsRead(userId?: string): Observable<boolean> {
    let url = `${this.apiUrl}/mark-all-read`;
    if (userId) url += `?user_id=${userId}`;
    
    return this.http.patch(url, {})
      .pipe(
        tap(() => {
          const current = this.notifications$.value;
          current.forEach(n => n.isRead = true);
          this.notifications$.next([...current]);
          this.unreadCount$.next(0);
        }),
        map(() => true),
        catchError(this.handleError)
      );
  }

  connectSSE(userId: string): Observable<Notification> {
    return new Observable(observer => {
      this.eventSource = new EventSource(`${this.apiUrl}/events?user_id=${userId}`);
      
      this.eventSource.onmessage = (event) => {
        try {
          const notification = JSON.parse(event.data) as Notification;
          observer.next(notification);
        } catch (error) {
          observer.error(error);
        }
      };
      
      this.eventSource.onerror = (error) => {
        observer.error(error);
        this.eventSource?.close();
      };
      
      return () => this.eventSource?.close();
    });
  }

  deleteNotification(notificationId: string): Observable<boolean> {
    return this.http.delete(`${this.apiUrl}/${notificationId}`)
      .pipe(
        tap(() => {
          const current = this.notifications$.value;
          this.notifications$.next(current.filter(n => n.id !== notificationId));
        }),
        map(() => true),
        catchError(this.handleError)
      );
  }

  private updateUnreadCount(): void {
    const unreadCount = this.notifications$.value.filter(n => !n.isRead).length;
    this.unreadCount$.next(unreadCount);
  }
}
```

### AdminService

```typescript
export class AdminService {
  private apiUrl = 'https://api.company.com/api/v1/admin';
  
  constructor(private http: HttpClient) {}

  // USER MANAGEMENT
  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/users`)
      .pipe(
        tap(users => this.users$.next(users)),
        catchError(this.handleError)
      );
  }

  createUser(user: User): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/users`, user)
      .pipe(
        tap(created => {
          this.logAuditEvent('CREATE', 'USER', created.id, created, undefined);
          const current = this.users$.value;
          this.users$.next([...current, created]);
        }),
        catchError(this.handleError)
      );
  }

  updateUser(id: string, updates: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/users/${id}`, updates)
      .pipe(
        tap(updated => {
          const current = this.users$.value;
          const original = current.find(u => u.id === id);
          this.logAuditEvent('UPDATE', 'USER', id, updated, original);
          const index = current.findIndex(u => u.id === id);
          current[index] = updated;
          this.users$.next([...current]);
        }),
        catchError(this.handleError)
      );
  }

  deleteUser(id: string): Observable<boolean> {
    return this.http.delete(`${this.apiUrl}/users/${id}`)
      .pipe(
        tap(() => {
          this.logAuditEvent('DELETE', 'USER', id, null, null);
          const current = this.users$.value;
          this.users$.next(current.filter(u => u.id !== id));
        }),
        map(() => true),
        catchError(this.handleError)
      );
  }

  assignRoles(userId: string, roles: string[]): Observable<User> {
    return this.http.patch<User>(
      `${this.apiUrl}/users/${userId}/roles`,
      { roles }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // AUDIT LOGS
  getAuditLogs(): Observable<AuditLog[]> {
    return this.http.get<AuditLog[]>(`${this.apiUrl}/audit-logs`)
      .pipe(
        tap(logs => this.auditLogs$.next(logs)),
        catchError(this.handleError)
      );
  }

  logAuditEvent(action: string, entityType: string, entityId: string, newValue: any, oldValue?: any): void {
    const auditLog: AuditLog = {
      id: this.generateId(),
      timestamp: new Date(),
      userId: 'current-user-id', // Get from auth service
      action,
      entityType,
      entityId,
      oldValue,
      newValue,
      status: 'SUCCESS',
      ipAddress: 'client-ip',
      userAgent: navigator.userAgent
    };

    this.http.post(`${this.apiUrl}/audit-logs`, auditLog).subscribe();
  }

  // SYSTEM CONFIG
  getSystemConfig(): Observable<SystemConfig[]> {
    return this.http.get<SystemConfig[]>(`${this.apiUrl}/config`)
      .pipe(
        tap(configs => this.systemConfigs$.next(configs)),
        catchError(this.handleError)
      );
  }

  updateSystemConfig(id: string, updates: Partial<SystemConfig>): Observable<SystemConfig> {
    return this.http.put<SystemConfig>(`${this.apiUrl}/config/${id}`, updates)
      .pipe(
        catchError(this.handleError)
      );
  }
}
```

---

## 🔒 Error Handling

Add a common error handler to your services:

```typescript
private handleError(error: HttpErrorResponse): Observable<any> {
  let errorMessage = 'An error occurred';
  
  if (error.error instanceof ErrorEvent) {
    // Client-side error
    errorMessage = error.error.message;
  } else {
    // Server-side error
    errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
  }
  
  console.error(errorMessage);
  
  // Emit error through subject for global error handling
  return throwError(() => new Error(errorMessage));
}
```

---

## 🔄 Retry Logic

Implement automatic retry for failed requests:

```typescript
import { retry, retryWhen, delay, take } from 'rxjs/operators';

getDocuments(): Observable<Document[]> {
  return this.http.get<Document[]>(`${this.apiUrl}`)
    .pipe(
      retryWhen(errors =>
        errors.pipe(
          delay(1000),
          take(3),
          tap(error => console.warn('Retrying request...'))
        )
      ),
      tap(documents => this.documents$.next(documents)),
      catchError(this.handleError)
    );
}
```

---

## ⏳ Loading States

Add loading indicators to components:

```typescript
export class GedListComponent implements OnInit {
  documents$: Observable<Document[]>;
  loading$ = new BehaviorSubject<boolean>(false);
  
  constructor(private documentService: DocumentService) {}
  
  ngOnInit(): void {
    this.loading$.next(true);
    this.documents$ = this.documentService.getDocuments()
      .pipe(
        finalize(() => this.loading$.next(false)),
        shareReplay(1)
      );
  }
}
```

In template:
```html
<div *ngIf="loading$ | async" class="loading-spinner">Loading...</div>
<div *ngIf="!(loading$ | async) && (documents$ | async) as documents">
  <!-- Content -->
</div>
```

---

## 🧪 Testing API Integration

Mock HTTP responses in tests:

```typescript
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

describe('DocumentService', () => {
  let service: DocumentService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [DocumentService]
    });
    
    service = TestBed.inject(DocumentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should fetch documents', () => {
    const mockDocs = [
      { id: '1', name: 'Doc1' },
      { id: '2', name: 'Doc2' }
    ];

    service.getDocuments().subscribe(docs => {
      expect(docs.length).toBe(2);
      expect(docs).toEqual(mockDocs);
    });

    const req = httpMock.expectOne('https://api.company.com/api/v1/documents');
    expect(req.request.method).toBe('GET');
    req.flush(mockDocs);
  });
});
```

---

## 📊 API Endpoint Reference

### Documents
- `GET /api/v1/documents` - List all documents
- `GET /api/v1/documents/{id}` - Get document by ID
- `GET /api/v1/documents/search` - Search documents
- `POST /api/v1/documents` - Upload new document
- `PUT /api/v1/documents/{id}` - Update document
- `DELETE /api/v1/documents/{id}` - Delete document
- `GET /api/v1/documents/{id}/versions` - Get document versions
- `POST /api/v1/documents/{id}/versions` - Add new version

### Events
- `GET /api/v1/events` - List all events
- `POST /api/v1/events` - Create event
- `PUT /api/v1/events/{id}` - Update event
- `DELETE /api/v1/events/{id}` - Delete event
- `PATCH /api/v1/events/{id}/status` - Change event status
- `POST /api/v1/events/{id}/participants` - Add participant
- `DELETE /api/v1/events/{id}/participants/{participantId}` - Remove participant

### Reservations
- `GET /api/v1/reservations/rooms` - List all rooms
- `POST /api/v1/reservations/rooms/book` - Book a room
- `GET /api/v1/reservations/rooms/conflicts` - Check room conflicts
- `PATCH /api/v1/reservations/rooms/{id}/approve` - Approve room reservation
- `GET /api/v1/reservations/equipment` - List all equipment
- `POST /api/v1/reservations/equipment/reserve` - Reserve equipment
- `PATCH /api/v1/reservations/equipment/{id}/pickup` - Pickup equipment
- `PATCH /api/v1/reservations/equipment/{id}/return` - Return equipment

### Interventions
- `GET /api/v1/interventions` - List all interventions
- `POST /api/v1/interventions` - Create intervention
- `PUT /api/v1/interventions/{id}` - Update intervention
- `DELETE /api/v1/interventions/{id}` - Delete intervention
- `PATCH /api/v1/interventions/{id}/assign` - Assign technician
- `PATCH /api/v1/interventions/{id}/complete` - Mark as completed
- `PATCH /api/v1/interventions/{id}/close` - Close intervention

### Notifications
- `GET /api/v1/notifications` - Get notifications
- `PATCH /api/v1/notifications/{id}/read` - Mark as read
- `PATCH /api/v1/notifications/mark-all-read` - Mark all as read
- `GET /api/v1/notifications/events` - SSE endpoint for real-time updates
- `DELETE /api/v1/notifications/{id}` - Delete notification

### Admin
- `GET /api/v1/admin/users` - List users
- `POST /api/v1/admin/users` - Create user
- `PUT /api/v1/admin/users/{id}` - Update user
- `DELETE /api/v1/admin/users/{id}` - Delete user
- `PATCH /api/v1/admin/users/{id}/roles` - Assign roles
- `GET /api/v1/admin/audit-logs` - Get audit logs
- `POST /api/v1/admin/audit-logs` - Create audit log
- `GET /api/v1/admin/config` - Get system config
- `PUT /api/v1/admin/config/{id}` - Update config

---

## 🌍 Environment Configuration

```typescript
// environment.ts
export const environment = {
  production: false,
  apiUrl: 'https://api.company.com/api/v1',
  notificationUrl: 'https://api.company.com/api/v1/notifications'
};

// environment.prod.ts
export const environment = {
  production: true,
  apiUrl: 'https://api.company.com/api/v1',
  notificationUrl: 'wss://api.company.com/api/v1/notifications'
};
```

Use in service:
```typescript
import { environment } from '../../environments/environment';

export class DocumentService {
  private apiUrl = `${environment.apiUrl}/documents`;
}
```

---

## 💾 Authentication & Authorization

Add authorization header to HTTP requests:

```typescript
import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('auth_token');
  
  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }
  
  return next(req);
};

// In app.config.ts
providers: [
  provideHttpClient(
    withInterceptors([authInterceptor])
  )
]
```

---

## ✅ Migration Checklist

- [ ] Import HttpClientModule in app.config.ts
- [ ] Update DocumentService methods to API calls
- [ ] Update EventService methods to API calls
- [ ] Update InvitationService methods to API calls
- [ ] Update ReservationService methods to API calls
- [ ] Update InterventionService methods to API calls
- [ ] Update NotificationService methods to API calls (including SSE)
- [ ] Update AdminService methods to API calls
- [ ] Add error handling to all services
- [ ] Add retry logic where appropriate
- [ ] Add loading states to components
- [ ] Configure environment variables
- [ ] Add authentication interceptor
- [ ] Test all API integrations
- [ ] Monitor API response times
- [ ] Add request/response logging

---

## 📈 Performance Tips

1. **Use OnPush Change Detection**: Improves performance with observables
2. **Add Caching**: Use `shareReplay()` for frequently accessed data
3. **Lazy Load Modules**: Load feature modules only when needed
4. **Virtual Scrolling**: For large lists, use `CDK Virtual Scroll`
5. **Pagination**: Implement server-side pagination for large datasets
6. **Debouncing**: Debounce search/filter inputs

---

## 🎉 You're Ready for Production!

Once all API endpoints are integrated, you have a fully functional enterprise dashboard ready for production deployment.

---

**Version**: 1.0  
**Last Updated**: 2024  
**Status**: ✅ Complete Integration Guide
