import { DateTime } from 'luxon';
import { OFFICE_OPEN_HOUR } from '@booking/core';

export interface KyivWeek {
  mondayKyiv: DateTime;
  sundayEndKyiv: DateTime;
  weekStartISO: string;
  fromISO: string;
  toISO: string;
  daysKyiv: DateTime[];
  isCurrentWeek: boolean;
}

export interface BookingGridPosition {
  dayIndex: number;
  startRow: number;
  span: number;
}

const UKRAINIAN_GENITIVE_MONTHS = [
  'січня',
  'лютого',
  'березня',
  'квітня',
  'травня',
  'червня',
  'липня',
  'серпня',
  'вересня',
  'жовтня',
  'листопада',
  'грудня',
];

export function formatKyivWeekRange(mondayKyiv: DateTime, sundayEndKyiv: DateTime): string {
  const startDay = mondayKyiv.day;
  const startMonth = UKRAINIAN_GENITIVE_MONTHS[mondayKyiv.month - 1];
  const endDay = sundayEndKyiv.day;
  const endMonth = UKRAINIAN_GENITIVE_MONTHS[sundayEndKyiv.month - 1];

  return `${startDay} ${startMonth} — ${endDay} ${endMonth}`;
}

export function getKyivWeek(weekParam?: string | null): KyivWeek {
  const currentMonday = DateTime.now().setZone('Europe/Kyiv').startOf('week');
  let mondayKyiv: DateTime = currentMonday;

  if (weekParam) {
    const parsed = DateTime.fromISO(weekParam, { zone: 'Europe/Kyiv' });
    if (parsed.isValid) {
      mondayKyiv = parsed.startOf('week');
    }
  }

  const sundayEndKyiv = mondayKyiv.plus({ days: 6 }).endOf('day');
  const weekStartISO = mondayKyiv.toUTC().toISO()!;
  const fromISO = weekStartISO;
  const toISO = sundayEndKyiv.toUTC().toISO()!;
  const daysKyiv = Array.from({ length: 7 }, (_, i) => mondayKyiv.plus({ days: i }));
  const isCurrentWeek = mondayKyiv.hasSame(currentMonday, 'day');

  return {
    mondayKyiv,
    sundayEndKyiv,
    weekStartISO,
    fromISO,
    toISO,
    daysKyiv,
    isCurrentWeek,
  };
}

export function getCurrentKyivWeek(): KyivWeek {
  return getKyivWeek();
}

export function getPrevKyivWeekParam(mondayKyiv: DateTime): string {
  return mondayKyiv.minus({ weeks: 1 }).toFormat('yyyy-MM-dd');
}

export function getNextKyivWeekParam(mondayKyiv: DateTime): string {
  return mondayKyiv.plus({ weeks: 1 }).toFormat('yyyy-MM-dd');
}

export function getViewerZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function formatInstantTime(instantISO: string, viewerZone: string): string {
  return DateTime.fromISO(instantISO, { zone: 'utc' }).setZone(viewerZone).toFormat('HH:mm');
}

export function getHourLabelsForGutter(dayKyiv: DateTime, viewerZone: string): string[] {
  return Array.from({ length: 10 }, (_, h) =>
    dayKyiv
      .set({ hour: OFFICE_OPEN_HOUR + h, minute: 0, second: 0, millisecond: 0 })
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
  const startSlotIndex = (startDt.hour - OFFICE_OPEN_HOUR) * 2 + (startDt.minute >= 30 ? 1 : 0);
  const span = Math.round(endDt.diff(startDt, 'minutes').minutes / 30);
  const startRow = startSlotIndex + 1;

  return {
    dayIndex,
    startRow,
    span,
  };
}

export function getDayColumnStatus(dayKyiv: DateTime, nowKyiv?: DateTime) {
  const now = nowKyiv ?? DateTime.now().setZone('Europe/Kyiv');
  const todayInKyiv = now.startOf('day');
  const dayStart = dayKyiv.startOf('day');

  const isToday = dayStart.hasSame(todayInKyiv, 'day');
  const isPastDay = dayStart < todayInKyiv;

  return {
    isToday,
    isPastDay,
  };
}

export function getPastRowsCount(dayKyiv: DateTime, nowKyiv?: DateTime): number {
  const now = nowKyiv ?? DateTime.now().setZone('Europe/Kyiv');
  const todayInKyiv = now.startOf('day');
  const dayStart = dayKyiv.startOf('day');

  if (dayStart < todayInKyiv) {
    return 20;
  }
  if (dayStart > todayInKyiv) {
    return 0;
  }

  // Today
  const minsFromMidnight = now.hour * 60 + now.minute;
  if (minsFromMidnight < 540) {
    return 0;
  }
  if (minsFromMidnight >= 1140) {
    return 20;
  }

  return Math.floor((minsFromMidnight - 540) / 30);
}

export function getNowLineInfo(dayKyiv: DateTime, isCurrentWeek: boolean, nowKyiv?: DateTime) {
  if (!isCurrentWeek) {
    return { isVisible: false, topPercentage: 0 };
  }

  const now = nowKyiv ?? DateTime.now().setZone('Europe/Kyiv');
  const todayInKyiv = now.startOf('day');
  const dayStart = dayKyiv.startOf('day');

  if (!dayStart.hasSame(todayInKyiv, 'day')) {
    return { isVisible: false, topPercentage: 0 };
  }

  const minsFromMidnight = now.hour * 60 + now.minute + now.second / 60;
  if (minsFromMidnight < 540 || minsFromMidnight >= 1140) {
    return { isVisible: false, topPercentage: 0 };
  }

  const topPercentage = ((minsFromMidnight - 540) / 600) * 100;
  return { isVisible: true, topPercentage };
}

function formatOffsetHuman(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? '−' : '+';
  const abs = Math.abs(totalMinutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return mins === 0 ? `${sign}${hours} год` : `${sign}${hours} год${mins} хв`;
}

export function formatTzBannerText(viewerZone: string, instant: DateTime): string {
  const kyivOffsetMinutes = instant.setZone('Europe/Kyiv').offset;
  const viewerOffsetMinutes = instant.setZone(viewerZone).offset;
  const diffMinutes = viewerOffsetMinutes - kyivOffsetMinutes;

  if (viewerZone === 'Europe/Kyiv') {
    const sign = kyivOffsetMinutes >= 0 ? '+' : '';
    const kyivHours = Math.abs(kyivOffsetMinutes) / 60;
    return `Київ (UTC${sign}${kyivHours})`;
  }

  if (diffMinutes === 0) {
    return `Час показано у вашому поясі — ${viewerZone}`;
  }

  return `Час показано у вашому поясі — ${viewerZone}, це ${formatOffsetHuman(diffMinutes)} до Києва`;
}
