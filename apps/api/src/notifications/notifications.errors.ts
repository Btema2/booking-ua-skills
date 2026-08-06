import { HttpStatus, NotFoundException } from '@nestjs/common';

const NOTIFICATION_NOT_FOUND_MESSAGE = 'Сповіщення не знайдено';

export function notificationNotFound(): NotFoundException {
  return new NotFoundException({ statusCode: HttpStatus.NOT_FOUND, message: NOTIFICATION_NOT_FOUND_MESSAGE });
}
