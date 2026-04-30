// Events Management Models
export enum EventStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  PUBLISHED = 'PUBLISHED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED'
}

export type EventWorkflowStep =
  | 'BROUILLON'
  | 'VALIDATION_MANAGER'
  | 'VALIDATION_SECURITE'
  | 'VALIDATION_DSN'
  | 'TERMINE'
  | 'REFUSE';

export type EventMode = 'PRESENTIEL' | 'EN_LIGNE' | 'HYBRIDE';

export interface EventParticipant {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: 'ATTENDING' | 'NOT_ATTENDING' | 'MAYBE';
  joinedAt?: Date;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  location: string;
  eventMode?: EventMode;
  onlineEvent?: boolean;
  onlineMeetingUrl?: string;
  onlineMeetingProvider?: string;
  zoomMeetingNumber?: string;
  zoomPasscode?: string;
  organiserId: string;
  organiserName: string;
  status: EventStatus;
  workflowStep?: EventWorkflowStep;
  businessVersion?: number;
  referenceCode?: string;
  rejectionReason?: string;
  hasExternalPartners?: boolean;
  participants: EventParticipant[];
  maxParticipants?: number;
  createdAt: Date;
  updatedAt: Date;
  imageUrl?: string;
  category?: string;
  visualColor?: 'Danger' | 'Success' | 'Primary' | 'Warning';
  type: 'CONFERENCE' | 'MEETING' | 'TRAINING' | 'WORKSHOP' | 'OTHER';
}

export interface EventFilter {
  searchTerm?: string;
  status?: EventStatus;
  startDate?: Date;
  endDate?: Date;
  type?: string;
  organiserId?: string;
}

export interface ZoomMeetingCredentials {
  sdkKey: string;
  signature: string;
  meetingNumber: string;
  passcode: string;
  userName: string;
  role: number;
  fallbackWebUrl: string;
  sdkConfigured: boolean;
}

export interface EventPhoto {
  id: string;
  eventId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: Date;
}
