import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { ApiPageResponse, buildApiUrl, extractPageContent } from '../config/backend-api.config';
import { Invitation, InvitationStatus, InvitationResponse } from '../models';
import { AuthService } from './auth.service';

interface BackendEventSummary {
  id: string;
  title: string;
  startAt: string;
  location?: string;
}

interface BackendPartnerInviteRequest {
  partnerName: string;
  partnerEmail: string;
}

interface BackendPartnerInviteResponse {
  id: string;
  eventId: string;
  partnerName: string;
  partnerEmail: string;
  accessApproved: boolean;
  createdAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class InvitationService {
  private readonly storageKey = 'enterprise-invitations-cache';
  private invitationsSubject = new BehaviorSubject<Invitation[]>([]);
  public invitations$ = this.invitationsSubject.asObservable();

  constructor(private http: HttpClient, private authService: AuthService) {
    this.restoreInvitationsFromStorage();
  }

  getInvitations(): Observable<Invitation[]> {
    return of(this.invitationsSubject.value);
  }

  getInvitationsByUser(userId: string): Observable<Invitation[]> {
    return this.getInvitations().pipe(
      map((invitations) => invitations.filter((invitation) => invitation.recipientId === userId || invitation.senderId === userId)),
    );
  }

  getInvitationsByEvent(eventId: string): Observable<Invitation[]> {
    return this.getInvitations().pipe(
      map((invitations) => invitations.filter((invitation) => invitation.eventId === eventId)),
    );
  }

  getInvitationsByStatus(status: InvitationStatus): Observable<Invitation[]> {
    return this.getInvitations().pipe(
      map((invitations) => invitations.filter((invitation) => invitation.status === status)),
    );
  }

  sendInvitation(invitation: Omit<Invitation, 'id' | 'sentAt'>): Observable<Invitation> {
    if (invitation.isExternalPartner) {
      const payload: BackendPartnerInviteRequest = {
        partnerName: invitation.recipientName,
        partnerEmail: invitation.recipientEmail,
      };

      const request$ = this.http
        .post<BackendPartnerInviteResponse>(buildApiUrl(`/api/v1/events/${invitation.eventId}/partners`), payload)
        .pipe(
          map((response) => this.mapPartnerInvitation(response, invitation)),
          tap((created) => this.updateInvitations([...this.invitationsSubject.value, created])),
        );

      return this.withFallback(request$, () => this.createLocalInvitation(invitation));
    }

    return this.createLocalInvitation(invitation);
  }

  sendBulkInvitations(
    eventId: string,
    recipients: Array<{ userId: string; email: string; name: string }>,
    senderId: string,
    senderName: string,
  ): Observable<Invitation[]> {
    const created = recipients.map((recipient) => ({
      id: this.generateId(),
      eventId,
      eventTitle: 'Event Invitation',
      eventDate: new Date(),
      eventLocation: 'TBD',
      recipientId: recipient.userId,
      recipientEmail: recipient.email,
      recipientName: recipient.name,
      senderId,
      senderName,
      status: InvitationStatus.PENDING,
      sentAt: new Date(),
      isExternalPartner: false,
      isVerifiedByDsn: true,
    } satisfies Invitation));

    this.invitationsSubject.next([...this.invitationsSubject.value, ...created]);
    this.persistInvitations(this.invitationsSubject.value);
    return of(created);
  }

  respondToInvitation(invitationId: string, response: InvitationResponse): Observable<Invitation | null> {
    const invitations = this.invitationsSubject.value;
    const invitation = invitations.find((item) => item.id === invitationId);
    if (!invitation) {
      return of(null);
    }

    invitation.status = response.status;
    invitation.respondedAt = response.respondedAt;
    invitation.responseReason = response.responseReason;
    this.updateInvitations([...invitations]);
    return of(invitation);
  }

  acceptInvitation(invitationId: string): Observable<Invitation | null> {
    return this.respondToInvitation(invitationId, {
      invitationId,
      status: InvitationStatus.ACCEPTED,
      respondedAt: new Date(),
    });
  }

  declineInvitation(invitationId: string, reason?: string): Observable<Invitation | null> {
    return this.respondToInvitation(invitationId, {
      invitationId,
      status: InvitationStatus.DECLINED,
      respondedAt: new Date(),
      responseReason: reason,
    });
  }

  getInvitation(id: string): Observable<Invitation | undefined> {
    return this.getInvitations().pipe(
      map((invitations) => invitations.find((invitation) => invitation.id === id)),
    );
  }

  cancelInvitation(id: string): Observable<boolean> {
    const invitations = this.invitationsSubject.value;
    const invitation = invitations.find((item) => item.id === id);
    if (!invitation) {
      return of(false);
    }

    invitation.status = InvitationStatus.CANCELLED;
    this.updateInvitations([...invitations]);
    return of(true);
  }

  getPartnerInvitations(): Observable<Invitation[]> {
    if (!this.canReadPartnerInvitationsFromBackend()) {
      return of(this.invitationsSubject.value.filter((invitation) => invitation.isExternalPartner));
    }

    return this.refreshPartnerInvitations().pipe(
      map(() => this.invitationsSubject.value.filter((invitation) => invitation.isExternalPartner)),
    );
  }

  verifyPartnerAccess(invitationId: string, verifiedBy: string): Observable<Invitation | null> {
    const invitations = this.invitationsSubject.value;
    const invitation = invitations.find((item) => item.id === invitationId);
    if (!invitation) {
      return of(null);
    }

    invitation.isVerifiedByDsn = true;
    invitation.verifiedBy = verifiedBy;
    invitation.verifiedAt = new Date();
    this.updateInvitations([...invitations]);
    return of(invitation);
  }

  private refreshPartnerInvitations(): Observable<Invitation[]> {
    const request$ = this.http
      .get<ApiPageResponse<BackendEventSummary>>(buildApiUrl('/api/v1/events'))
      .pipe(
        map((response) => extractPageContent(response)),
        switchMap((events) => {
          if (events.length === 0) {
            return of([] as Invitation[]);
          }

          const perEventRequests = events.map((event) =>
            this.http
              .get<BackendPartnerInviteResponse[]>(buildApiUrl(`/api/v1/events/${event.id}/partners`))
              .pipe(
                map((partners) => partners.map((partner) => this.mapPartnerInvitation(partner, {
                  eventId: event.id,
                  eventTitle: event.title,
                  eventDate: this.toDate(event.startAt),
                  eventLocation: event.location || '',
                  senderId: 'backend',
                  senderName: 'Backend API',
                  recipientId: partner.partnerEmail,
                  recipientEmail: partner.partnerEmail,
                  recipientName: partner.partnerName,
                  status: InvitationStatus.PENDING,
                  respondedAt: undefined,
                  message: '',
                  responseReason: undefined,
                  isExternalPartner: true,
                  isVerifiedByDsn: partner.accessApproved,
                  verifiedBy: undefined,
                  verifiedAt: undefined,
                  partnerOrganization: undefined,
                }))),
                catchError(() => of([] as Invitation[])),
              ),
          );

          return forkJoin(perEventRequests).pipe(
            map((collections) => collections.flat()),
          );
        }),
        tap((partnerInvitations) => this.mergePartnerInvitations(partnerInvitations)),
      );

    return this.withFallback(request$, () => of(this.invitationsSubject.value.filter((item) => item.isExternalPartner)));
  }

  private mergePartnerInvitations(partnerInvitations: Invitation[]): void {
    const internalInvitations = this.invitationsSubject.value.filter((invitation) => !invitation.isExternalPartner);
    const merged = new Map<string, Invitation>();

    [...internalInvitations, ...partnerInvitations].forEach((invitation) => {
      merged.set(invitation.id, invitation);
    });

    this.updateInvitations(Array.from(merged.values()));
  }

  private createLocalInvitation(invitation: Omit<Invitation, 'id' | 'sentAt'>): Observable<Invitation> {
    const created: Invitation = {
      ...invitation,
      id: this.generateId(),
      sentAt: new Date(),
      status: InvitationStatus.PENDING,
      isVerifiedByDsn: invitation.isExternalPartner ? false : true,
    };

    this.updateInvitations([...this.invitationsSubject.value, created]);
    return of(created);
  }

  private mapPartnerInvitation(
    response: BackendPartnerInviteResponse,
    context: Omit<Invitation, 'id' | 'sentAt'>,
  ): Invitation {
    return {
      id: response.id,
      eventId: response.eventId || context.eventId,
      eventTitle: context.eventTitle || 'Event',
      eventDate: context.eventDate,
      eventLocation: context.eventLocation,
      recipientId: context.recipientId || response.partnerEmail,
      recipientEmail: response.partnerEmail || context.recipientEmail,
      recipientName: response.partnerName || context.recipientName,
      senderId: context.senderId,
      senderName: context.senderName,
      status: context.status,
      sentAt: this.toDate(response.createdAt),
      respondedAt: context.respondedAt,
      message: context.message,
      responseReason: context.responseReason,
      isExternalPartner: true,
      isVerifiedByDsn: response.accessApproved,
      verifiedBy: context.verifiedBy,
      verifiedAt: context.verifiedAt,
      partnerOrganization: context.partnerOrganization,
    };
  }

  private toDate(value?: string): Date {
    if (!value) {
      return new Date();
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  private withFallback<T>(request$: Observable<T>, fallbackFactory: () => Observable<T>): Observable<T> {
    return request$.pipe(
      catchError(() => fallbackFactory()),
    );
  }

  private updateInvitations(invitations: Invitation[]): void {
    this.invitationsSubject.next(invitations);
    this.persistInvitations(invitations);
  }

  private restoreInvitationsFromStorage(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const raw = window.localStorage.getItem(this.storageKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Invitation[];
      const invitations = parsed.map((item) => ({
        ...item,
        eventDate: this.toDate((item as unknown as { eventDate?: string }).eventDate),
        sentAt: this.toDate((item as unknown as { sentAt?: string }).sentAt),
        respondedAt: item.respondedAt ? this.toDate(item.respondedAt as unknown as string) : undefined,
        verifiedAt: item.verifiedAt ? this.toDate(item.verifiedAt as unknown as string) : undefined,
      }));

      this.invitationsSubject.next(invitations);
    } catch {
      window.localStorage.removeItem(this.storageKey);
    }
  }

  private persistInvitations(invitations: Invitation[]): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(this.storageKey, JSON.stringify(invitations));
  }

  private generateId(): string {
    return Math.random().toString(36).slice(2, 11);
  }

  private canReadPartnerInvitationsFromBackend(): boolean {
    const role = this.authService.currentRole;
    return role === 'ADMIN' || role === 'MANAGER' || role === 'DSN_DIRECTOR';
  }
}
