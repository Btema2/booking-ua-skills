import { DateTime } from 'luxon';

export interface KyivWeek {
  mondayKyiv: DateTime;
  sundayEndKyiv: DateTime;
  weekStartISO: string;
  fromISO: string;
  toISO: string;
  daysKyiv: DateTime[];
}

export interface BookingGridPosition {
  dayIndex: number;
  startRow: number;
  span: number;
}

export function getCurrentKyivWeek(): KyivWeek {
  const mondayKyiv = DateTime.now().setZone('Europe/Kyiv').startOf('week');
  const sundayEndKyiv = mondayKyiv.plus({ days: 6 }).endOf('day');
  const weekStartISO = mondayKyiv.toUTC().toISO()!;
  const fromISO = weekStartISO;
  const toISO = sundayEndKyiv.toUTC().toISO()!;
  const daysKyiv = Array.from({ length: 7 }, (_, i) => mondayKyiv.plus({ days: i }));

  return {
    mondayKyiv,
    sundayEndKyiv,
    weekStartISO,
    fromISO,
    toISO,
    daysKyiv,
  };
}

export function getViewerZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function formatInstantTime(instantISO: string, viewerZone: string): string {
  return DateTime.fromISO(instantISO, { zone: 'utc' }).setZone(viewerZone).toFormat('HH:mm');
}

export function getHourLabelsForGutter(daysKyiv: DateTime[], viewerZone: string): string[] {
  const mondayKyiv = daysKyiv[0];
  return Array.from({ length: 10 }, (_, h) =>
    mondayKyiv
      .set({ hour: 9 + h, minute: 0, second: 0, millisecond: 0 })
      .toUTC()
      .setZone(viewerZone)
      .toFormat('HH:mm'),
  );
}

export function getBookingGridRow(
  startsAtISO: string | Date,
  endsAtISO: string | Date,
): BookingGridPosition {
  const startDt =
    typeof startsAtISO === 'string'
      ? DateTime.fromISO(startsAtISO, { zone: 'utc' }).setZone('Europe/Kyiv')
      : DateTime.fromJSDate(startsAtISO, { zone: 'utc' }).setZone('Europe/Kyiv');
  const endDt =
    typeof endsAtISO === 'string'
      ? DateTime.fromISO(endsAtISO, { zone: 'utc' }).setZone('Europe/Kyiv')
      : DateTime.fromJSDate(endsAtISO, { zone: 'utc' }).setZone('Europe/Kyiv');

  const dayIndex = startDt.weekday - 1;
  const startSlotIndex = (startDt.hour - 9) * 2 + (startDt.minute >= 30 ? 1 : 0);
  const span = Math.round(endDt.diff(startDt, 'minutes').minutes / 30);
  const startRow = startSlotIndex + 1;

  return {
    dayIndex,
    startRow,
    span,
  };
}
