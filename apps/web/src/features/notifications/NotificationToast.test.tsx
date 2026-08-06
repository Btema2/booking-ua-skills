import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { jsonResponse, resetHarness } from '../../test/harness';
import * as timeUtils from '../rooms/timeUtils';
import { NotificationToast } from './NotificationToast';
import { notificationsQueryKey } from './useNotifications';
import type { NotificationDTO } from './api';

const ENDING_SOON: NotificationDTO = {
  id: 'n1',
  bookingId: 'b1',
  kind: 'ending_soon',
  createdAt: '2026-08-06T10:50:00.000Z',
  readAt: null,
  bookingTitle: 'Синк по Q4',
  bookingEndsAt: '2026-08-06T11:00:00.000Z',
  roomId: 1,
  roomName: 'Дуб',
};

function setup(initial: NotificationDTO[], notifyBeforeMinutes = 10) {
  const fetchMock = vi.fn((input: unknown, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (method === 'GET' && url === '/api/notifications') {
      return Promise.resolve(jsonResponse(200, { notifications: initial, notifyBeforeMinutes }));
    }
    return Promise.reject(new Error(`Unhandled request: ${method} ${url}`));
  });

  vi.stubGlobal('fetch', fetchMock);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <NotificationToast />
    </QueryClientProvider>,
  );

  return {
    // The poller landing new data is what the component actually reacts to —
    // driving the cache directly is the deterministic way to simulate that
    // without depending on fetch/refetch timing in the test itself.
    setPolledData(next: NotificationDTO[]) {
      queryClient.setQueryData(notificationsQueryKey, { notifications: next, notifyBeforeMinutes });
    },
    // The component's "is this the first-ever data?" check only makes sense
    // once that first fetch has actually landed — otherwise a synchronous
    // setPolledData() call right after render becomes the first data, and
    // the assertion under test would be exercising the wrong branch.
    waitForInitialLoad: () =>
      waitFor(() => expect(queryClient.getQueryState(notificationsQueryKey)?.status).toBe('success')),
  };
}

describe('NotificationToast', () => {
  beforeEach(() => {
    // Render in Europe/Warsaw (UTC+2 in August), same fixture pattern as MyBookingsPage.test.tsx.
    vi.spyOn(timeUtils, 'getViewerZone').mockReturnValue('Europe/Warsaw');
  });

  afterEach(resetHarness);

  it('does not toast for a notification that was already there on first load', async () => {
    const { waitForInitialLoad } = setup([ENDING_SOON]);
    await waitForInitialLoad();

    // Give a possible (wrong) toast render a chance to appear.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('pops the interpolated N-minute reminder for a notification that appears after the first poll', async () => {
    const { setPolledData, waitForInitialLoad } = setup([]);
    await waitForInitialLoad();

    setPolledData([ENDING_SOON]);

    expect(await screen.findByText('Зустріч завершується за 10 хв')).toBeTruthy();
    expect(screen.getByText('«Синк по Q4» · Дуб · до 13:00')).toBeTruthy();
  });

  it('dismisses on close-button click', async () => {
    const { setPolledData, waitForInitialLoad } = setup([]);
    await waitForInitialLoad();

    setPolledData([ENDING_SOON]);
    await screen.findByRole('status');

    fireEvent.click(screen.getByRole('button', { name: 'Закрити' }));

    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  });
});
