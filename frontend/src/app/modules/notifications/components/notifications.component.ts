import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Notification, NotificationType } from '../../../core/models';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Option, SelectComponent } from '../../../shared/components/form/select/select.component';

type NotificationFilter = 'all' | 'reservation' | 'intervention' | 'event' | 'ged' | 'equipment' | 'system';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectComponent],
  template: `
    <div class="space-y-6">
      <div class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] sm:p-5">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-[260px_auto] sm:items-center sm:justify-between">
          <app-select
            [(ngModel)]="selectedFilter"
            [options]="filterOptions"
            placeholder="Toutes"
          ></app-select>

          <div class="flex justify-end">
            <button
              type="button"
              (click)="markAllVisibleAsRead()"
              [disabled]="visibleUnreadCount === 0"
              class="h-11 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
            >
              Tout marquer comme lu
            </button>
          </div>
        </div>
      </div>

      <ng-container *ngIf="todayNotifications.length > 0">
        <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300">Aujourd'hui</h3>
        <div class="space-y-3">
          <article
            *ngFor="let notification of todayNotifications"
            class="rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-gray-300 dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-gray-700"
            (click)="handleNotificationClick(notification)"
          >
            <div class="flex items-start gap-3">
              <span class="mt-2 inline-block h-2.5 w-2.5 rounded-full" [ngClass]="getLeadingDotClass(notification)"></span>

              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="truncate text-xl font-semibold text-gray-900 dark:text-white/90">
                    {{ notification.title }}
                  </p>
                  <span class="inline-flex rounded-full px-3 py-1 text-xs font-semibold" [ngClass]="getBadgeClass(notification)">
                    {{ getCategoryLabel(notification) }}
                  </span>
                </div>

                <p *ngIf="notification.message" class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {{ notification.message }}
                </p>

                <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {{ getRelativeTime(notification.createdAt) }}
                </p>
              </div>

              <div class="pt-2">
                <span
                  *ngIf="!notification.isRead"
                  class="inline-block h-2.5 w-2.5 rounded-full bg-brand-500"
                ></span>
              </div>
            </div>
          </article>
        </div>
      </ng-container>

      <ng-container *ngIf="yesterdayNotifications.length > 0">
        <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300">Hier</h3>
        <div class="space-y-3">
          <article
            *ngFor="let notification of yesterdayNotifications"
            class="rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-gray-300 dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-gray-700"
            (click)="handleNotificationClick(notification)"
          >
            <div class="flex items-start gap-3">
              <span class="mt-2 inline-block h-2.5 w-2.5 rounded-full" [ngClass]="getLeadingDotClass(notification)"></span>

              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="truncate text-xl font-semibold text-gray-900 dark:text-white/90">
                    {{ notification.title }}
                  </p>
                  <span class="inline-flex rounded-full px-3 py-1 text-xs font-semibold" [ngClass]="getBadgeClass(notification)">
                    {{ getCategoryLabel(notification) }}
                  </span>
                </div>

                <p *ngIf="notification.message" class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {{ notification.message }}
                </p>

                <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {{ getRelativeTime(notification.createdAt) }}
                </p>
              </div>

              <div class="pt-2">
                <span
                  *ngIf="!notification.isRead"
                  class="inline-block h-2.5 w-2.5 rounded-full bg-brand-500"
                ></span>
              </div>
            </div>
          </article>
        </div>
      </ng-container>

      <ng-container *ngIf="olderNotifications.length > 0">
        <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300">Anterieur</h3>
        <div class="space-y-3">
          <article
            *ngFor="let notification of olderNotifications"
            class="rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-gray-300 dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-gray-700"
            (click)="handleNotificationClick(notification)"
          >
            <div class="flex items-start gap-3">
              <span class="mt-2 inline-block h-2.5 w-2.5 rounded-full" [ngClass]="getLeadingDotClass(notification)"></span>

              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="truncate text-xl font-semibold text-gray-900 dark:text-white/90">
                    {{ notification.title }}
                  </p>
                  <span class="inline-flex rounded-full px-3 py-1 text-xs font-semibold" [ngClass]="getBadgeClass(notification)">
                    {{ getCategoryLabel(notification) }}
                  </span>
                </div>

                <p *ngIf="notification.message" class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {{ notification.message }}
                </p>

                <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {{ getRelativeTime(notification.createdAt) }}
                </p>
              </div>

              <div class="pt-2">
                <span
                  *ngIf="!notification.isRead"
                  class="inline-block h-2.5 w-2.5 rounded-full bg-brand-500"
                ></span>
              </div>
            </div>
          </article>
        </div>
      </ng-container>

      <div
        *ngIf="filteredNotifications.length === 0"
        class="rounded-2xl border border-gray-200 bg-white p-10 text-center dark:border-gray-800 dark:bg-white/[0.03]"
      >
        <p class="text-base text-gray-600 dark:text-gray-300">Aucune notification pour ce filtre.</p>
      </div>
    </div>
  `,
})
export class NotificationsComponent implements OnInit, OnDestroy {
  currentRecipient = 'current-user';
  selectedFilter: NotificationFilter = 'all';
  notifications: Notification[] = [];

  readonly filterOptions: Option[] = [
    { value: 'all', label: 'Toutes' },
    { value: 'reservation', label: 'Reservations' },
    { value: 'intervention', label: 'Interventions' },
    { value: 'event', label: 'Evenements' },
    { value: 'ged', label: 'GED' },
    { value: 'equipment', label: 'Equipement' },
    { value: 'system', label: 'Systeme' },
  ];

  private authSubscription?: Subscription;
  private notificationsSubscription?: Subscription;

  constructor(
    private notificationService: NotificationService,
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.authSubscription = this.authService.currentUser$.subscribe((user) => {
      this.currentRecipient = this.resolveRecipientKey(user);
      this.subscribeNotifications();
    });
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.notificationsSubscription?.unsubscribe();
  }

  get filteredNotifications(): Notification[] {
    return this.notifications.filter((notification) => {
      if (this.selectedFilter === 'all') {
        return true;
      }

      return this.resolveCategory(notification) === this.selectedFilter;
    });
  }

  get todayNotifications(): Notification[] {
    return this.filteredNotifications.filter((notification) => this.isToday(this.toDate(notification.createdAt)));
  }

  get yesterdayNotifications(): Notification[] {
    return this.filteredNotifications.filter((notification) => this.isYesterday(this.toDate(notification.createdAt)));
  }

  get olderNotifications(): Notification[] {
    return this.filteredNotifications.filter((notification) => {
      const createdAt = this.toDate(notification.createdAt);
      return !this.isToday(createdAt) && !this.isYesterday(createdAt);
    });
  }

  get visibleUnreadCount(): number {
    return this.filteredNotifications.filter((notification) => !notification.isRead).length;
  }

  handleNotificationClick(notification: Notification): void {
    if (!notification.isRead) {
      this.notificationService.markAsRead(notification.id).subscribe(() => {
        this.applyReadState(notification.id);
      });
    }

    const actionUrl = notification.data?.actionUrl;
    if (actionUrl && actionUrl.startsWith('/')) {
      this.router.navigateByUrl(actionUrl);
    }
  }

  markAllVisibleAsRead(): void {
    const unreadIds = this.filteredNotifications
      .filter((notification) => !notification.isRead)
      .map((notification) => notification.id);

    if (unreadIds.length === 0) {
      return;
    }

    this.notificationService.markMultipleAsRead(unreadIds).subscribe(() => {
      this.notifications = this.notifications.map((notification) => {
        if (!unreadIds.includes(notification.id)) {
          return notification;
        }

        return {
          ...notification,
          isRead: true,
          readAt: new Date(),
        };
      });
    });
  }

  getCategoryLabel(notification: Notification): string {
    const category = this.resolveCategory(notification);

    if (category === 'reservation') {
      return 'Reservation';
    }
    if (category === 'intervention') {
      return 'Intervention';
    }
    if (category === 'event') {
      return 'Evenement';
    }
    if (category === 'ged') {
      return 'GED';
    }
    if (category === 'equipment') {
      return 'Equipement';
    }

    return 'Systeme';
  }

  getBadgeClass(notification: Notification): string {
    const category = this.resolveCategory(notification);
    const text = this.getNotificationText(notification);

    if (category === 'intervention') {
      if (text.includes('critique')) {
        return 'bg-error-50 text-error-700 dark:bg-error-500/20 dark:text-error-300';
      }

      return 'bg-success-50 text-success-700 dark:bg-success-500/20 dark:text-success-300';
    }

    if (category === 'reservation') {
      return 'bg-success-50 text-success-700 dark:bg-success-500/20 dark:text-success-300';
    }

    if (category === 'event') {
      return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300';
    }

    if (category === 'ged') {
      return 'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300';
    }

    if (category === 'equipment') {
      return 'bg-warning-50 text-warning-700 dark:bg-warning-500/20 dark:text-warning-300';
    }

    return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  }

  getLeadingDotClass(notification: Notification): string {
    const category = this.resolveCategory(notification);
    const text = this.getNotificationText(notification);

    if (category === 'intervention') {
      if (text.includes('critique')) {
        return 'bg-error-500';
      }

      return 'bg-success-500';
    }

    if (category === 'reservation') {
      return 'bg-success-500';
    }

    if (category === 'event') {
      return 'bg-indigo-500';
    }

    if (category === 'ged') {
      return 'bg-blue-500';
    }

    if (category === 'equipment') {
      return 'bg-warning-500';
    }

    return 'bg-gray-500';
  }

  getRelativeTime(value: Date): string {
    const date = this.toDate(value);
    const now = new Date();
    const diffMs = Math.max(now.getTime() - date.getTime(), 0);
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 60) {
      return `Il y a ${Math.max(diffMinutes, 1)} min`;
    }

    if (this.isToday(date)) {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      if (minutes === 0) {
        return `Il y a ${hours} h`;
      }

      return `Il y a ${hours} h ${minutes} min`;
    }

    if (this.isYesterday(date)) {
      return `Hier ${this.formatTime(date)}`;
    }

    return this.formatDate(date);
  }

  private subscribeNotifications(): void {
    this.notificationsSubscription?.unsubscribe();
    this.notificationsSubscription = this.notificationService
      .getNotifications(this.currentRecipient)
      .subscribe((notifications) => {
        const safeNotifications = Array.isArray(notifications) ? notifications : [];
        this.notifications = [...safeNotifications].sort(
          (left, right) => this.toDate(right.createdAt).getTime() - this.toDate(left.createdAt).getTime(),
        );
      });
  }

  private resolveRecipientKey(user: { id?: string; username?: string; email?: string } | null): string {
    if (!user) {
      return 'current-user';
    }

    const username = user.username?.trim();
    if (username) {
      return username;
    }

    const email = user.email?.trim().toLowerCase() ?? '';
    if (email.includes('@')) {
      return email.split('@')[0];
    }

    return user.id?.trim() || 'current-user';
  }

  private resolveCategory(notification: Notification): Exclude<NotificationFilter, 'all'> {
    const text = this.getNotificationText(notification);

    if (text.includes('materiel') || text.includes('equipement')) {
      return 'equipment';
    }

    if (
      notification.type === NotificationType.RESERVATION_APPROVED ||
      notification.type === NotificationType.RESERVATION_REJECTED
    ) {
      return 'reservation';
    }

    if (
      notification.type === NotificationType.INTERVENTION_ASSIGNED ||
      notification.type === NotificationType.INTERVENTION_UPDATED ||
      notification.type === NotificationType.INTERVENTION_COMPLETED
    ) {
      return 'intervention';
    }

    if (
      notification.type === NotificationType.INVITATION_SENT ||
      notification.type === NotificationType.INVITATION_ACCEPTED ||
      notification.type === NotificationType.INVITATION_DECLINED ||
      notification.type === NotificationType.EVENT_REMINDER
    ) {
      return 'event';
    }

    if (notification.type === NotificationType.DOCUMENT_SHARED) {
      return 'ged';
    }

    return 'system';
  }

  private getNotificationText(notification: Notification): string {
    return `${notification.title} ${notification.message}`.trim().toLowerCase();
  }

  private applyReadState(notificationId: string): void {
    this.notifications = this.notifications.map((notification) => {
      if (notification.id !== notificationId) {
        return notification;
      }

      return {
        ...notification,
        isRead: true,
        readAt: new Date(),
      };
    });
  }

  private isToday(date: Date): boolean {
    const now = new Date();
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }

  private isYesterday(date: Date): boolean {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    return (
      date.getFullYear() === yesterday.getFullYear() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getDate() === yesterday.getDate()
    );
  }

  private formatTime(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}h${minutes}`;
  }

  private formatDate(date: Date): string {
    const months = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  private toDate(value: Date): Date {
    return value instanceof Date ? value : new Date(value);
  }
}
