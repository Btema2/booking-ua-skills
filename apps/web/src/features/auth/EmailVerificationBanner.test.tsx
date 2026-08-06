import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { jsonResponse, resetHarness } from '../../test/harness';
import { EmailVerificationBanner } from './EmailVerificationBanner';
import { RoomSchedulePage } from '../rooms/RoomSchedulePage';

const UNVERIFIED_USER = {
  id: '1f2ac0d6-8d61-4a2f-9f5c-7b2b6c0a1d31',
  name: 'Іван',
  email: 'ivan@example.com',
  emailVerifiedAt: null,
};

const VERIFIED_USER = {
  id: '2b3ac0d6-8d61-4a2f-9f5c-7b2b6c0a1d32',
  name: 'Петро',
  email: 'petro@example.com',
  emailVerifiedAt: '2026-08-06T12:00:00.000Z',
};

function renderBannerWithUser(
  user: typeof UNVERIFIED_USER | typeof VERIFIED_USER | null,
  handlers: Record<string, () => unknown> = {},
) {
  const fetchMock = vi.fn((input: unknown, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (method === 'GET' && url === '/api/auth/me') {
      return Promise.resolve(jsonResponse(200, { user }));
    }
    const handler = handlers[`${method} ${url}`];
    if (handler) {
      return Promise.resolve(handler());
    }
    return Promise.reject(new Error(`Unhandled request: ${method} ${url}`));
  });

  vi.stubGlobal('fetch', fetchMock);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <EmailVerificationBanner />
    </QueryClientProvider>,
  );
  return { ...result, fetchMock };
}

describe('EmailVerificationBanner', () => {
  afterEach(resetHarness);

  it('unverified user sees the banner; verified user does not', async () => {
    const { unmount } = renderBannerWithUser(UNVERIFIED_USER);
    expect(
      await screen.findByText('Для створення бронювань необхідно підтвердити електронну пошту.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Надіслати ще раз' })).toBeTruthy();
    unmount();
    resetHarness();

    renderBannerWithUser(VERIFIED_USER);
    await waitFor(() => {
      expect(
        screen.queryByText('Для створення бронювань необхідно підтвердити електронну пошту.'),
      ).toBeNull();
    });
  });

  it('resend button calls the endpoint and shows confirmation text', async () => {
    let resendCalled = false;
    renderBannerWithUser(UNVERIFIED_USER, {
      'POST /api/auth/verify/resend': () => {
        resendCalled = true;
        return jsonResponse(200, { message: 'Token sent' });
      },
    });

    const resendBtn = await screen.findByRole('button', { name: 'Надіслати ще раз' });
    fireEvent.click(resendBtn);

    await waitFor(() => {
      expect(resendCalled).toBe(true);
      expect(
        screen.getByText('Посилання надіслано! Перевірте консоль сервера'),
      ).toBeTruthy();
    });
  });

  it('blocks create booking modal for unverified user clicking a free slot in RoomSchedulePage', async () => {
    const fetchMock = vi.fn((input: unknown, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'GET' && url === '/api/auth/me') {
        return Promise.resolve(jsonResponse(200, { user: UNVERIFIED_USER }));
      }
      if (method === 'GET' && url.includes('/api/rooms')) {
        return Promise.resolve(
          jsonResponse(200, {
            rooms: [{ id: 1, name: 'Дуб', floor: 2, capacity: 12, amenities: 'Проєктор' }],
          }),
        );
      }
      if (method === 'GET' && url.includes('/bookings')) {
        return Promise.resolve(jsonResponse(200, { bookings: [] }));
      }
      return Promise.reject(new Error(`Unhandled request: ${method} ${url}`));
    });

    vi.stubGlobal('fetch', fetchMock);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/rooms/1?week=2026-08-10']}>
          <Routes>
            <Route path="/rooms/:roomId" element={<RoomSchedulePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText('Для створення бронювань необхідно підтвердити електронну пошту.'),
    ).toBeTruthy();

    const cellEl = document.querySelector('[data-grid-cell="0-2"]');
    expect(cellEl).toBeTruthy();
    fireEvent.click(cellEl!);

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
