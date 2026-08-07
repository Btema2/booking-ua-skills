import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { jsonResponse, resetHarness } from '../../test/harness';
import { NotificationBell } from './NotificationBell';
import type { NotificationDTO } from './api';

const ENDING_SOON: NotificationDTO = {
  id: 'n1',
  bookingId: 'b1',
  kind: 'ending_soon',
  message: null,
  createdAt: '2026-08-06T10:50:00.000Z',
  readAt: null,
  bookingTitle: 'Синк по Q4',
  bookingEndsAt: '2026-08-06T11:00:00.000Z',
  roomId: 1,
  roomName: 'Дуб',
};

const SERIES_CONFLICT: NotificationDTO = {
  id: 'n2',
  bookingId: null,
  kind: 'series_conflict',
  message: 'Не вдалося створити 2 з 4 зустрічей через конфлікт слотів.',
  createdAt: '2026-08-06T10:50:00.000Z',
  readAt: null,
  bookingTitle: null,
  bookingEndsAt: null,
  roomId: null,
  roomName: null,
};

function renderBell(notifications: NotificationDTO[], notifyBeforeMinutes = 10) {
  const readCalls: string[] = [];
  const fetchMock = vi.fn((input: unknown, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (method === 'GET' && url === '/api/notifications') {
      return Promise.resolve(jsonResponse(200, { notifications, notifyBeforeMinutes }));
    }
    const readMatch = /^\/api\/notifications\/(.+)\/read$/.exec(url);
    if (method === 'POST' && readMatch) {
      readCalls.push(readMatch[1]);
      return Promise.resolve(jsonResponse(204, null));
    }
    return Promise.reject(new Error(`Unhandled request: ${method} ${url}`));
  });

  vi.stubGlobal('fetch', fetchMock);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <NotificationBell />
    </QueryClientProvider>,
  );
  return { readCalls };
}

describe('NotificationBell', () => {
  afterEach(resetHarness);

  it('shows the unread dot and lists the interpolated N-minute reminder, then marks it read on open', async () => {
    const { readCalls } = renderBell([ENDING_SOON], 10);

    const trigger = await screen.findByRole('button', { name: 'Сповіщення' });
    await waitFor(() => expect(trigger.querySelector('[aria-hidden="true"].bg-error')).toBeTruthy());

    fireEvent.click(trigger);

    expect(await screen.findByText('Зустріч завершується за 10 хв')).toBeTruthy();
    expect(screen.getByText(/Синк по Q4/)).toBeTruthy();
    expect(screen.getByText(/Дуб/)).toBeTruthy();

    await waitFor(() => expect(readCalls).toEqual(['n1']));
  });

  it('renders series_conflict notification safely without crashing on missing booking fields', async () => {
    const { readCalls } = renderBell([SERIES_CONFLICT]);

    const trigger = await screen.findByRole('button', { name: 'Сповіщення' });
    await waitFor(() => expect(trigger.querySelector('[aria-hidden="true"].bg-error')).toBeTruthy());

    fireEvent.click(trigger);

    expect(await screen.findByText('Не вдалося створити повторювані зустрічі')).toBeTruthy();
    expect(screen.getByText('Не вдалося створити 2 з 4 зустрічей через конфлікт слотів.')).toBeTruthy();

    await waitFor(() => expect(readCalls).toEqual(['n2']));
  });

  it('shows the empty state naming the reminder lead time when there are no notifications', async () => {
    renderBell([], 15);

    const trigger = await screen.findByRole('button', { name: 'Сповіщення' });
    fireEvent.click(trigger);

    expect(await screen.findByText('Сповіщень немає')).toBeTruthy();
    expect(screen.getByText('Ми нагадаємо за 15 хв до кінця вашої зустрічі.')).toBeTruthy();
  });

  it('does not render the unread dot when every notification is already read', async () => {
    renderBell([{ ...ENDING_SOON, readAt: '2026-08-06T10:51:00.000Z' }]);

    const trigger = await screen.findByRole('button', { name: 'Сповіщення' });
    await waitFor(() => expect(trigger.querySelector('[aria-hidden="true"].bg-error')).toBeNull());
  });

  it('closes the panel on Escape', async () => {
    renderBell([ENDING_SOON]);

    const trigger = await screen.findByRole('button', { name: 'Сповіщення' });
    fireEvent.click(trigger);
    expect(await screen.findByRole('region', { name: 'Сповіщення' })).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('region', { name: 'Сповіщення' })).toBeNull());
  });
});
