import { apiRequest } from '../../lib/api';

export interface NotificationDTO {
  id: string;
  bookingId: string | null;
  kind: string;
  message: string | null;
  createdAt: string;
  readAt: string | null;
  bookingTitle: string | null;
  bookingEndsAt: string | null;
  roomId: number | null;
  roomName: string | null;
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
