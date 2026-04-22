import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, catchError, forkJoin, map, of, tap, throwError } from 'rxjs';
import { buildApiUrl } from '../config/backend-api.config';
import {
  Notification,
  NotificationPreference,
  NotificationType,
} from '../models';

interface BackendNotificationResponse {
  id: string;
  recipientUsername: string;
  title: string;
  message: string;
  read: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface BackendNotificationCreateRequest {
  recipientUsername: string;
  title: string;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService implements OnDestroy {
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  private notificationPreferencesSubject = new BehaviorSubject<NotificationPreference[]>([]);
  public notificationPreferences$ = this.notificationPreferencesSubject.asObservable();

  private sseSubject = new Subject<Notification>();
  public sseNotifications$ = this.sseSubject.asObservable();

  private currentRecipient = '';
  private eventSource: EventSource | null = null;

  constructor(private http: HttpClient) {
    this.updateUnreadCount();
  }

  ngOnDestroy(): void {
    this.eventSource?.close();
  }

  getNotifications(userId?: string): Observable<Notification[]> {
    const recipient = (userId || this.currentRecipient || '').trim();
    this.currentRecipient = recipient;

    const request$ = this.http
      .get<BackendNotificationResponse[]>(buildApiUrl('/api/v1/notifications'))
      .pipe(
        map((items) => items.map((item) => this.mapNotification(item))),
        tap((notifications) => {
          this.notificationsSubject.next(notifications);
          this.updateUnreadCount();
        }),
      );

    return this.withFallback(request$, () => {
      const notifications = [...this.notificationsSubject.value];
      this.updateUnreadCount();
      return of(notifications);
    });
  }

  getUnreadNotifications(userId?: string): Observable<Notification[]> {
    return this.getNotifications(userId).pipe(
      map((notifications) => notifications.filter((notification) => !notification.isRead)),
    );
  }

  getUnreadCount(userId?: string): Observable<number> {
    const recipient = (userId || '').trim();
    if (recipient) {
      this.currentRecipient = recipient;
    }
    this.updateUnreadCount();
    return this.unreadCountSubject.asObservable();
  }

  markAsRead(notificationId: string): Observable<Notification | null> {
    const request$ = this.http
      .put<BackendNotificationResponse>(buildApiUrl(`/api/v1/notifications/${notificationId}/read`), {})
      .pipe(
        map((response) => this.mapNotification(response)),
        tap((updated) => this.upsertNotification(updated)),
      );

    return this.withFallback(request$, () => {
      const notifications = this.notificationsSubject.value;
      const notification = notifications.find((item) => item.id === notificationId) ?? null;
      if (!notification) {
        return of(null);
      }

      notification.isRead = true;
      notification.readAt = new Date();
      this.notificationsSubject.next([...notifications]);
      this.updateUnreadCount();
      return of(notification);
    });
  }

  markMultipleAsRead(notificationIds: string[]): Observable<boolean> {
    if (notificationIds.length === 0) {
      return of(true);
    }

    const request$ = forkJoin(notificationIds.map((id) => this.markAsRead(id))).pipe(
      map(() => true),
    );

    return this.withFallback(request$, () => {
      const notifications = this.notificationsSubject.value;
      notificationIds.forEach((id) => {
        const notification = notifications.find((item) => item.id === id);
        if (notification) {
          notification.isRead = true;
          notification.readAt = new Date();
        }
      });
      this.notificationsSubject.next([...notifications]);
      this.updateUnreadCount();
      return of(true);
    });
  }

  markAllAsRead(userId?: string): Observable<boolean> {
    const unreadIds = this.notificationsSubject.value
      .filter((item) => !item.isRead)
      .map((item) => item.id);

    return this.markMultipleAsRead(unreadIds);
  }

  deleteNotification(notificationId: string): Observable<boolean> {
    this.notificationsSubject.next(this.notificationsSubject.value.filter((item) => item.id !== notificationId));
    this.updateUnreadCount();
    return of(true);
  }

  deleteMultiple(notificationIds: string[]): Observable<boolean> {
    this.notificationsSubject.next(
      this.notificationsSubject.value.filter((item) => !notificationIds.includes(item.id)),
    );
    this.updateUnreadCount();
    return of(true);
  }

  createNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'isRead' | 'readAt'>): Observable<Notification> {
    const payload: BackendNotificationCreateRequest = {
      recipientUsername: notification.userId,
      title: notification.title,
      message: notification.message,
    };

    const request$ = this.http
      .post<BackendNotificationResponse>(buildApiUrl('/api/v1/notifications'), payload)
      .pipe(
        map((response) => this.mapNotification(response)),
        tap((created) => {
          this.notificationsSubject.next([created, ...this.notificationsSubject.value]);
          this.sseSubject.next(created);
          this.updateUnreadCount();
        }),
      );

    return this.withFallback(request$, () => {
      const created: Notification = {
        ...notification,
        id: this.generateId(),
        createdAt: new Date(),
        isRead: false,
      };
      this.notificationsSubject.next([created, ...this.notificationsSubject.value]);
      this.sseSubject.next(created);
      this.updateUnreadCount();
      return of(created);
    });
  }

  getNotificationPreferences(userId?: string): Observable<NotificationPreference[]> {
    const uid = userId || this.currentRecipient;
    return of(this.notificationPreferencesSubject.value.filter((item) => item.userId === uid));
  }

  updateNotificationPreference(preference: NotificationPreference): Observable<NotificationPreference> {
    const preferences = this.notificationPreferencesSubject.value;
    const index = preferences.findIndex((item) =>
      item.userId === preference.userId && item.notificationType === preference.notificationType,
    );

    if (index >= 0) {
      preferences[index] = preference;
    } else {
      preferences.push(preference);
    }

    this.notificationPreferencesSubject.next([...preferences]);
    return of(preference);
  }

  connectSSE(userId: string): Observable<Notification> {
    this.currentRecipient = userId.trim();
    this.eventSource?.close();
    this.openSSEConnection();

    return this.sseNotifications$;
  }

  private openSSEConnection(): void {
    try {
      this.eventSource = new EventSource(buildApiUrl('/api/v1/notifications/stream'));
      this.eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as BackendNotificationResponse;
          const notification = this.mapNotification(payload);
          this.notificationsSubject.next([notification, ...this.notificationsSubject.value]);
          this.sseSubject.next(notification);
          this.updateUnreadCount();
        } catch {
          // Ignore malformed SSE payloads.
        }
      };
      this.eventSource.onerror = () => {
        this.eventSource?.close();
        this.eventSource = null;
      };
    } catch {
      this.eventSource = null;
    }
  }

  private mapNotification(response: BackendNotificationResponse): Notification {
    const createdAt = this.toDate(response.createdAt);
    const updatedAt = this.toDate(response.updatedAt, createdAt);
    const isRead = response.read;

    return {
      id: response.id,
      userId: response.recipientUsername,
      type: this.inferNotificationType(response.title, response.message),
      title: response.title,
      message: response.message || '',
      createdAt,
      isRead,
      readAt: isRead ? updatedAt : undefined,
    };
  }

  private inferNotificationType(title: string, message: string): NotificationType {
    const text = `${title} ${message}`.toLowerCase();

    if (text.includes('reservation') && text.includes('rej')) {
      return NotificationType.RESERVATION_REJECTED;
    }
    if (text.includes('reservation')) {
      return NotificationType.RESERVATION_APPROVED;
    }
    if (text.includes('invitation') && text.includes('accept')) {
      return NotificationType.INVITATION_ACCEPTED;
    }
    if (text.includes('invitation') && text.includes('declin')) {
      return NotificationType.INVITATION_DECLINED;
    }
    if (text.includes('invitation')) {
      return NotificationType.INVITATION_SENT;
    }
    if (text.includes('intervention') && text.includes('complete')) {
      return NotificationType.INTERVENTION_COMPLETED;
    }
    if (text.includes('intervention') && text.includes('assign')) {
      return NotificationType.INTERVENTION_ASSIGNED;
    }
    if (text.includes('intervention')) {
      return NotificationType.INTERVENTION_UPDATED;
    }
    if (text.includes('document')) {
      return NotificationType.DOCUMENT_SHARED;
    }
    if (text.includes('event') || text.includes('evenement')) {
      return NotificationType.EVENT_REMINDER;
    }

    return NotificationType.SYSTEM_ALERT;
  }

  private upsertNotification(updated: Notification): void {
    const notifications = this.notificationsSubject.value;
    const index = notifications.findIndex((item) => item.id === updated.id);

    if (index >= 0) {
      notifications[index] = updated;
      this.notificationsSubject.next([...notifications]);
    } else {
      this.notificationsSubject.next([updated, ...notifications]);
    }

    this.updateUnreadCount();
  }

  private updateUnreadCount(): void {
    const unreadCount = this.notificationsSubject.value.filter((item) => !item.isRead).length;
    this.unreadCountSubject.next(unreadCount);
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
