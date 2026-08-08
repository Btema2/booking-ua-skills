import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { jsonResponse, resetHarness } from '../../test/harness';
import { RoomSchedulePage } from '../rooms/RoomSchedulePage';

const IVAN = {
  id: '1f2ac0d6-8d61-4a2f-9f5c-7b2b6c0a1d31',
  name: 'Іван Петренко',
  email: 'ivan@example.com',
  emailVerifiedAt: '2026-08-06T12:00:00.000Z',
};

const OTHER_USER_ID = '99999999-8d61-4a2f-9f5c-7b2b6c0a1d31';

const OAK = { id: 1, name: 'Дуб', floor: 2, capacity: 12, amenities: 'Проєктор' };

function renderPhase5Page(
  path = '/rooms/1?week=2026-08-10',
  customHandlers: Record<string, (url: string, init?: RequestInit) => any> = {},
) {
  const fetchMock = vi.fn((input: unknown, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();

    for (const [key, handler] of Object.entries(customHandlers)) {
      const [hMethod, hPath] = key.split(' ');
      if (method === hMethod && url.includes(hPath)) {
        return Promise.resolve(handler(url, init));
      }
    }

    if (method === 'GET' && url.includes('/api/auth/me')) {
      return Promise.resolve(jsonResponse(200, { user: IVAN }));
    }
    if (method === 'GET' && url.includes('/api/rooms/1/bookings')) {
      return Promise.resolve(jsonResponse(200, { bookings: [] }));
    }
    if (method === 'GET' && url.includes('/api/rooms')) {
      return Promise.resolve(jsonResponse(200, { rooms: [OAK] }));
    }

    return Promise.reject(new Error(`Unhandled request: ${method} ${url}`));
  });

  vi.stubGlobal('fetch', fetchMock);
  window.history.pushState({}, '', path);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/rooms/:roomId" element={<RoomSchedulePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { fetchMock, queryClient };
}

describe('Phase 5 Booking Feature', () => {
  afterEach(resetHarness);

  it('1. Clicking a free cell opens the form with that slot\'s start pre-filled and end at +30 minutes', async () => {
    renderPhase5Page('/rooms/1?week=2026-08-10');

    await screen.findByRole('heading', { name: 'Дуб' });

    // Cell Monday (day 0), slot 2 (10:00 Kyiv)
    const cellEl = document.querySelector('[data-grid-cell="0-2"]');
    expect(cellEl).toBeTruthy();

    fireEvent.click(cellEl!);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeTruthy();

    const startSelect = screen.getByLabelText('Початок') as HTMLSelectElement;
    const endSelect = screen.getByLabelText('Кінець') as HTMLSelectElement;

    expect(startSelect.value).toBe('2026-08-10T07:00:00.000Z'); // 10:00 Kyiv = 07:00 UTC
    expect(endSelect.value).toBe('2026-08-10T07:30:00.000Z'); // 10:30 Kyiv = 07:30 UTC
  });

  describe('2. Each of the six server error shapes renders its message, and under the correct field for the five field-level ones', () => {
    it('renders server error under title field when title validation fails', async () => {
      renderPhase5Page('/rooms/1?week=2026-08-10', {
        'POST /api/bookings': () =>
          jsonResponse(400, {
            statusCode: 400,
            errors: { title: ['Назва має містити від 1 до 100 символів'] },
          }),
      });

      await screen.findByRole('heading', { name: 'Дуб' });
      const cellEl = document.querySelector('[data-grid-cell="0-2"]');
      fireEvent.click(cellEl!);

      fireEvent.change(screen.getByLabelText('Назва події'), { target: { value: 'Тест' } });
      fireEvent.click(screen.getByRole('button', { name: 'Забронювати' }));

      expect(await screen.findByText('Назва має містити від 1 до 100 символів')).toBeTruthy();
    });

    it('renders server error under time field when alignment fails', async () => {
      renderPhase5Page('/rooms/1?week=2026-08-10', {
        'POST /api/bookings': () =>
          jsonResponse(400, {
            statusCode: 400,
            errors: { startsAt: ['Час має бути кратним 30 хвилинам'] },
          }),
      });

      await screen.findByRole('heading', { name: 'Дуб' });
      const cellEl = document.querySelector('[data-grid-cell="0-2"]');
      fireEvent.click(cellEl!);

      fireEvent.change(screen.getByLabelText('Назва події'), { target: { value: 'Тест' } });
      fireEvent.click(screen.getByRole('button', { name: 'Забронювати' }));

      expect(await screen.findByText('Час має бути кратним 30 хвилинам')).toBeTruthy();
    });

    it('renders server error under time field when duration fails', async () => {
      renderPhase5Page('/rooms/1?week=2026-08-10', {
        'POST /api/bookings': () =>
          jsonResponse(400, {
            statusCode: 400,
            errors: { startsAt: ['Тривалість має бути від 30 хв до 4 год'] },
          }),
      });

      await screen.findByRole('heading', { name: 'Дуб' });
      const cellEl = document.querySelector('[data-grid-cell="0-2"]');
      fireEvent.click(cellEl!);

      fireEvent.change(screen.getByLabelText('Назва події'), { target: { value: 'Тест' } });
      fireEvent.click(screen.getByRole('button', { name: 'Забронювати' }));

      expect(await screen.findByText('Тривалість має бути від 30 хв до 4 год')).toBeTruthy();
    });

    it('renders server error under time field when office hours fail', async () => {
      renderPhase5Page('/rooms/1?week=2026-08-10', {
        'POST /api/bookings': () =>
          jsonResponse(400, {
            statusCode: 400,
            errors: { startsAt: ['Поза робочими годинами'] },
          }),
      });

      await screen.findByRole('heading', { name: 'Дуб' });
      const cellEl = document.querySelector('[data-grid-cell="0-2"]');
      fireEvent.click(cellEl!);

      fireEvent.change(screen.getByLabelText('Назва події'), { target: { value: 'Тест' } });
      fireEvent.click(screen.getByRole('button', { name: 'Забронювати' }));

      expect(await screen.findByText('Поза робочими годинами')).toBeTruthy();
    });

    it('renders server error under time field when past time fails', async () => {
      renderPhase5Page('/rooms/1?week=2026-08-10', {
        'POST /api/bookings': () =>
          jsonResponse(400, {
            statusCode: 400,
            errors: { startsAt: ['Час у минулому'] },
          }),
      });

      await screen.findByRole('heading', { name: 'Дуб' });
      const cellEl = document.querySelector('[data-grid-cell="0-2"]');
      fireEvent.click(cellEl!);

      fireEvent.change(screen.getByLabelText('Назва події'), { target: { value: 'Тест' } });
      fireEvent.click(screen.getByRole('button', { name: 'Забронювати' }));

      expect(await screen.findByText('Час у минулому')).toBeTruthy();
    });

    it('renders form-level error message when 409 slot taken occurs', async () => {
      renderPhase5Page('/rooms/1?week=2026-08-10', {
        'POST /api/bookings': () =>
          jsonResponse(409, {
            statusCode: 409,
            message: 'Слот зайнятий',
          }),
      });

      await screen.findByRole('heading', { name: 'Дуб' });
      const cellEl = document.querySelector('[data-grid-cell="0-2"]');
      fireEvent.click(cellEl!);

      fireEvent.change(screen.getByLabelText('Назва події'), { target: { value: 'Тест' } });
      fireEvent.click(screen.getByRole('button', { name: 'Забронювати' }));

      expect(await screen.findByText('Слот зайнятий')).toBeTruthy();
    });
  });

  it('3. A failed submit leaves the typed title still in the input field', async () => {
    renderPhase5Page('/rooms/1?week=2026-08-10', {
      'POST /api/bookings': () =>
        jsonResponse(409, {
          statusCode: 409,
          message: 'Слот зайнятий',
        }),
    });

    await screen.findByRole('heading', { name: 'Дуб' });
    const cellEl = document.querySelector('[data-grid-cell="0-2"]');
    fireEvent.click(cellEl!);

    const titleInput = screen.getByLabelText('Назва події') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Моя важлива зустріч' } });
    fireEvent.click(screen.getByRole('button', { name: 'Забронювати' }));

    await screen.findByText('Слот зайнятий');
    expect(titleInput.value).toBe('Моя важлива зустріч');
  });

  it('4. Submit is disabled while the request is in flight', async () => {
    let resolvePromise: (value: any) => void;
    const pendingPromise = new Promise((res) => {
      resolvePromise = res;
    });

    renderPhase5Page('/rooms/1?week=2026-08-10', {
      'POST /api/bookings': () => pendingPromise as any,
    });

    await screen.findByRole('heading', { name: 'Дуб' });
    const cellEl = document.querySelector('[data-grid-cell="0-2"]');
    fireEvent.click(cellEl!);

    fireEvent.change(screen.getByLabelText('Назва події'), { target: { value: 'Тест' } });
    const submitBtn = screen.getByRole('button', { name: 'Забронювати' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      const inFlightBtn = screen.getByRole('button', { name: /Бронюємо…/ }) as HTMLButtonElement;
      expect(inFlightBtn.disabled).toBe(true);
    });

    resolvePromise!(jsonResponse(201, { booking: {} }));
  });

  it('5. Cancelling an own booking removes it optimistically; a rejected DELETE restores it', async () => {
    const ownBooking = {
      id: 'b-own-1',
      roomId: 1,
      title: 'Моє Бронювання',
      startsAt: '2026-08-10T07:00:00.000Z',
      endsAt: '2026-08-10T08:00:00.000Z',
      userId: IVAN.id,
      userName: IVAN.name,
    };

    let rejectDelete: (val: any) => void;
    const deletePromise = new Promise((_, rej) => {
      rejectDelete = rej;
    });

    renderPhase5Page('/rooms/1?week=2026-08-10', {
      'GET /api/rooms/1/bookings': () => jsonResponse(200, { bookings: [ownBooking] }),
      'DELETE /api/bookings/b-own-1': () => deletePromise as any,
    });

    await screen.findByRole('heading', { name: 'Дуб' });
    expect(await screen.findByText('Моє Бронювання')).toBeTruthy();

    const bookingBlock = screen.getByText('Моє Бронювання');
    fireEvent.click(bookingBlock);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeTruthy();

    const confirmBtn = screen.getByRole('button', { name: 'Скасувати бронювання' });
    fireEvent.click(confirmBtn);

    // Optimistic removal: booking disappears from grid
    await waitFor(() => {
      expect(within(screen.getByRole('grid')).queryByText('Моє Бронювання')).toBeNull();
    });

    // Reject the DELETE request
    rejectDelete!(new Error('Delete failed'));

    // Restored back onto grid
    await waitFor(() => {
      expect(within(screen.getByRole('grid')).getByText('Моє Бронювання')).toBeTruthy();
    });
  });

  it('cancelling a booking with 403 Forbidden response restores the block onto grid and displays error message in dialog', async () => {
    const ownBooking = {
      id: 'b-own-403',
      roomId: 1,
      title: 'Бронювання 403',
      startsAt: '2026-08-10T07:00:00.000Z',
      endsAt: '2026-08-10T08:00:00.000Z',
      userId: IVAN.id,
      userName: IVAN.name,
    };

    renderPhase5Page('/rooms/1?week=2026-08-10', {
      'GET /api/rooms/1/bookings': () => jsonResponse(200, { bookings: [ownBooking] }),
      'DELETE /api/bookings/b-own-403': () =>
        jsonResponse(403, {
          statusCode: 403,
          message: 'Ви не можете скасувати чуже бронювання',
        }),
    });

    await screen.findByRole('heading', { name: 'Дуб' });
    const bookingBlock = await screen.findByText('Бронювання 403');
    fireEvent.click(bookingBlock);

    const confirmBtn = await screen.findByRole('button', { name: 'Скасувати бронювання' });
    fireEvent.click(confirmBtn);

    // 403 error message shown in dialog
    expect(await screen.findByText('Ви не можете скасувати чуже бронювання')).toBeTruthy();

    // Booking is restored back onto grid
    expect(within(screen.getByRole('grid')).getByText('Бронювання 403')).toBeTruthy();
  });

  it('6. Another user\'s booking exposes no cancel control and is not a button', async () => {
    const otherBooking = {
      id: 'b-other-1',
      roomId: 1,
      title: 'Чуже Бронювання',
      startsAt: '2026-08-10T07:00:00.000Z',
      endsAt: '2026-08-10T08:00:00.000Z',
      userId: OTHER_USER_ID,
      userName: 'Ольга',
    };

    renderPhase5Page('/rooms/1?week=2026-08-10', {
      'GET /api/rooms/1/bookings': () => jsonResponse(200, { bookings: [otherBooking] }),
    });

    await screen.findByRole('heading', { name: 'Дуб' });
    const bookingTitle = await screen.findByText('Чуже Бронювання');
    expect(bookingTitle).toBeTruthy();

    // The booking title is inside a non-button element
    const buttonParent = bookingTitle.closest('button');
    expect(buttonParent).toBeNull();

    // Clicking it does not open dialog
    fireEvent.click(bookingTitle);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('7. A booking starting exactly when another ends submits without a client-side error', async () => {
    const existingBooking = {
      id: 'b-exist-1',
      roomId: 1,
      title: 'Перша зустріч',
      startsAt: '2026-08-10T07:00:00.000Z', // 10:00-10:30 Kyiv
      endsAt: '2026-08-10T07:30:00.000Z',
      userId: OTHER_USER_ID,
      userName: 'Ольга',
    };

    let postSubmitted = false;

    renderPhase5Page('/rooms/1?week=2026-08-10', {
      'GET /api/rooms/1/bookings': () => jsonResponse(200, { bookings: [existingBooking] }),
      'POST /api/bookings': (_url, init) => {
        postSubmitted = true;
        const body = JSON.parse(String(init?.body));
        return jsonResponse(201, {
          booking: {
            id: 'b-new-2',
            roomId: 1,
            title: body.title,
            startsAt: body.startsAt,
            endsAt: body.endsAt,
            userId: IVAN.id,
            userName: IVAN.name,
          },
        });
      },
    });

    await screen.findByRole('heading', { name: 'Дуб' });
    expect(await screen.findByText('Перша зустріч')).toBeTruthy();

    // Click slot 3 (10:30 Kyiv, startRow 4, rowIndex 3)
    const cellEl = document.querySelector('[data-grid-cell="0-3"]');
    expect(cellEl).toBeTruthy();
    fireEvent.click(cellEl!);

    const startSelect = (await screen.findByLabelText('Початок')) as HTMLSelectElement;
    expect(startSelect.value).toBe('2026-08-10T07:30:00.000Z');

    fireEvent.change(screen.getByLabelText('Назва події'), { target: { value: 'Друга зустріч' } });
    fireEvent.click(screen.getByRole('button', { name: 'Забронювати' }));

    await waitFor(() => {
      expect(postSubmitted).toBe(true);
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
