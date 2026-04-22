// Notifications System Models
export enum NotificationType {
  RESERVATION_APPROVED = 'RESERVATION_APPROVED',
  RESERVATION_REJECTED = 'RESERVATION_REJECTED',
  INVITATION_SENT = 'INVITATION_SENT',
  INVITATION_ACCEPTED = 'INVITATION_ACCEPTED',
  INVITATION_DECLINED = 'INVITATION_DECLINED',
  INTERVENTION_ASSIGNED = 'INTERVENTION_ASSIGNED',
  INTERVENTION_UPDATED = 'INTERVENTION_UPDATED',
  INTERVENTION_COMPLETED = 'INTERVENTION_COMPLETED',
  EVENT_REMINDER = 'EVENT_REMINDER',
  DOCUMENT_SHARED = 'DOCUMENT_SHARED',
  SYSTEM_ALERT = 'SYSTEM_ALERT'
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: {
    relatedId?: string;
    relatedType?: string;
    actionUrl?: string;
  };
  createdAt: Date;
  isRead: boolean;
  readAt?: Date;
  expiresAt?: Date;
}

export interface NotificationRead {
  id: string;
  notificationId: string;
  userId: string;
  readAt: Date;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  notificationType: NotificationType;
  isEnabled: boolean;
  channel: 'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH';
}
