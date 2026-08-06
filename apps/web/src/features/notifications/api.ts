import { apiRequest } from '../../lib/api';

export interface NotificationDTO {
  id: string;
  bookingId: string;
  kind: string;
  createdAt: string;
  readAt: string | null;
  bookingTitle: string;
  bookingEndsAt: string;
  roomId: number;
  roomName: string;
}

export interface NotificationsResponse {
  notifications: NotificationDTO[];
  notifyBeforeMinutes: number;
}

export function fetchNotifications(): Promise<NotificationsResponse> {
  return apiRequest<NotificationsResponse>('/notifications');
}

export function markNotificationRead(id: string): Promise<void> {
  return apiRequest<void>(`/notifications/${id}/read`, { method: 'POST' });
}
