import { CreateBookingSchema, CreateBookingSeriesSchema, MyBookingsQuerySchema, type PublicUser } from '@booking/core';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { parseOrThrow } from '../common/parse-or-throw';
import { BookingsService, type CreateSeriesResult } from './bookings.service';
import type { BookingRow, PaginatedMyBookings } from './bookings.repository';

// A non-uuid `:id` must be a clean 400, not a 500 from Postgres choking on the
// cast, so it's validated the same way as any request body.
const BookingIdParamSchema = z.object({ id: z.uuid() });
const CancelBookingQuerySchema = z.object({ scope: z.enum(['series']).optional() });

@Controller('api/bookings')
@UseGuards(AuthGuard)
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get('mine')
  async listMine(@Query() queryParams: unknown, @CurrentUser() user: PublicUser): Promise<PaginatedMyBookings> {
    const query = parseOrThrow(MyBookingsQuerySchema, queryParams);
    return this.bookings.listMine(user, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: unknown, @CurrentUser() user: PublicUser): Promise<{ booking: BookingRow }> {
    const input = parseOrThrow(CreateBookingSchema, body);
    return { booking: await this.bookings.create(user, input) };
  }

  @Post('series')
  @HttpCode(HttpStatus.CREATED)
  async createSeries(@Body() body: unknown, @CurrentUser() user: PublicUser): Promise<CreateSeriesResult> {
    const input = parseOrThrow(CreateBookingSeriesSchema, body);
    return this.bookings.createSeries(user, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(@Param() params: unknown, @Query() query: unknown, @CurrentUser() user: PublicUser): Promise<void> {
    const { id } = parseOrThrow(BookingIdParamSchema, params);
    const { scope } = parseOrThrow(CancelBookingQuerySchema, query);
    if (scope === 'series') {
      await this.bookings.cancelSeries(user, id);
      return;
    }
    await this.bookings.cancel(user, id);
  }
}
