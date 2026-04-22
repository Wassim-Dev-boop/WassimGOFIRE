// Events Management Models
export enum EventStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED'
}

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
  onlineEvent?: boolean;
  zoomMeetingNumber?: string;
  zoomPasscode?: string;
  organiserId: string;
  organiserName: string;
  status: EventStatus;
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
}
