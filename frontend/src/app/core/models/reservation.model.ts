// Room & Equipment Reservations Models
export interface Room {
  id: string;
  name: string;
  description: string;
  capacity: number;
  location: string;
  amenities: string[];
  imageUrl?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface RoomReservation {
  id: string;
  roomId: string;
  roomName: string;
  userId: string;
  userName: string;
  title: string;
  purpose: string;
  startDate: Date;
  endDate: Date;
  attendeeCount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';
  approvedBy?: string;
  approvalDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Equipment {
  id: string;
  name: string;
  description: string;
  category: 'PROJECTOR' | 'LAPTOP' | 'CAMERA' | 'MICROPHONE' | 'SCREEN' | 'OTHER';
  serialNumber: string;
  status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'RETIRED';
  location: string;
  imageUrl?: string;
  createdAt: Date;
}

export interface EquipmentReservation {
  id: string;
  equipmentId: string;
  equipmentName: string;
  userId: string;
  userName: string;
  purpose: string;
  startDate: Date;
  endDate: Date;
  status: 'PENDING' | 'APPROVED' | 'IN_USE' | 'RETURNED' | 'CANCELLED';
  pickedUpAt?: Date;
  returnedAt?: Date;
  approvalDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoomAvailability {
  roomId: string;
  date: Date;
  availableTimeSlots: {
    startTime: string;
    endTime: string;
  }[];
}
