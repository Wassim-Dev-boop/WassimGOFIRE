// Invitations Management Models
export enum InvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  CANCELLED = 'CANCELLED'
}

export interface Invitation {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: Date;
  eventLocation: string;
  recipientId: string;
  recipientEmail: string;
  recipientName: string;
  senderId: string;
  senderName: string;
  status: InvitationStatus;
  sentAt: Date;
  respondedAt?: Date;
  message?: string;
  responseReason?: string;
  isExternalPartner?: boolean;
  isVerifiedByDsn?: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
  partnerOrganization?: string;
}

export interface InvitationResponse {
  invitationId: string;
  status: InvitationStatus;
  responseReason?: string;
  respondedAt: Date;
}
