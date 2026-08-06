import type { PublicUser } from '@booking/core';
import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { parseOrThrow } from '../common/parse-or-throw';
import { NotificationsService } from './notifications.service';
import type { NotificationRow } from './notifications.repository';

const NotificationIdParamSchema = z.object({ id: z.uuid() });

@Controller('api/notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(@CurrentUser() user: PublicUser): Promise<{ notifications: NotificationRow[]; notifyBeforeMinutes: number }> {
    return this.notifications.listMine(user.id);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markRead(@Param() params: unknown, @CurrentUser() user: PublicUser): Promise<void> {
    const { id } = parseOrThrow(NotificationIdParamSchema, params);
    await this.notifications.markRead(id, user.id);
  }
}
