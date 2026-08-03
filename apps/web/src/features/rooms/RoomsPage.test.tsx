import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';
import { jsonResponse, resetHarness } from '../../test/harness';
import { RoomsPage } from './RoomsPage';

/**
 * `renderApp` boots the whole router, which another agent owns this phase. This
 * mounts the screen on its own providers instead, stubbing fetch the same way the
 * shared harness does so the URL assertions still run against a real history.
 */
type Handler = () => unknown;

function renderRoomsPage(path: string, handlers: Readonly<Record<string, Handler>>) {
  const fetchMock = vi.fn((input: unknown, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const handler = handlers[`${method} ${url}`];
    if (!handler) {
      return Promise.reject(new Error(`Unhandled request: ${method} ${url}`));
    }
    return Promise.resolve(handler());
  });

  vi.stubGlobal('fetch', fetchMock);
  window.history.pushState({}, '', path);
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <RoomsPage />
      </BrowserRouter>
    </QueryClientProvider>,
  );
  return { fetchMock };
}

const OAK = { id: 1, name: 'Дуб', floor: 2, capacity: 12, amenities: 'Проєктор, маркерна дошка' };
const MAPLE = { id: 2, name: 'Клен', floor: 3, capacity: 6, amenities: null };
const SYCAMORE = { id: 3, name: 'Явір', floor: 1, capacity: 4, amenities: 'Телевізор' };

const allRooms = () => jsonResponse(200, { rooms: [OAK, MAPLE, SYCAMORE] });

const roomCard = (name: string) => screen.getByRole('article', { name: new RegExp(name) });

describe('room list', () => {
  afterEach(resetHarness);

  it('renders one card per room the server returned', async () => {
    renderRoomsPage('/', { 'GET /api/rooms': allRooms });

    await screen.findByRole('article', { name: /Дуб/ });
    expect(roomCard('Дуб')).toBeTruthy();
    expect(roomCard('Клен')).toBeTruthy();
    expect(roomCard('Явір')).toBeTruthy();
    expect(within(roomCard('Дуб')).getByText('Проєктор, маркерна дошка')).toBeTruthy();
    expect(within(roomCard('Дуб')).getByText('2 поверх')).toBeTruthy();
  });

  it('renders no amenities line at all for a room whose amenities are null', async () => {
    renderRoomsPage('/', { 'GET /api/rooms': allRooms });
    await screen.findByRole('article', { name: /Клен/ });

    const maple = roomCard('Клен');
    // An empty <p> would still paint a blank line where the amenities belong.
    const blankLines = Array.from(maple.querySelectorAll('p')).filter(
      (line) => line.textContent?.trim() === '',
    );
    expect(blankLines).toHaveLength(0);
    expect(within(maple).queryByText('Проєктор, маркерна дошка')).toBeNull();
  });

  it('names the room capacity and floor in text a screen reader can read', async () => {
    renderRoomsPage('/', { 'GET /api/rooms': allRooms });
    await screen.findByRole('article', { name: /Дуб/ });

    const name = roomCard('Дуб').textContent ?? '';
    expect(name).toContain('Місткість: 12 осіб');
    expect(name).toContain('Поверх 2');
  });
});

describe('capacity filter', () => {
  afterEach(resetHarness);

  it('is exposed as a single radiogroup with one checked option', async () => {
    renderRoomsPage('/', { 'GET /api/rooms': allRooms });
    await screen.findByRole('article', { name: /Дуб/ });

    const group = screen.getByRole('radiogroup');
    expect(within(group).getAllByRole('radio')).toHaveLength(6);
    expect(screen.getByRole('radio', { name: 'Будь-яка' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(screen.getByRole('radio', { name: 'від 8' }).getAttribute('aria-checked')).toBe('false');
  });

  it('refetches with ?minCapacity=8 and writes the choice to the URL', async () => {
    const { fetchMock } = renderRoomsPage('/', {
      'GET /api/rooms': allRooms,
      'GET /api/rooms?minCapacity=8': () => jsonResponse(200, { rooms: [OAK] }),
    });
    await screen.findByRole('article', { name: /Дуб/ });

    fireEvent.click(screen.getByRole('radio', { name: 'від 8' }));

    await waitFor(() => expect(screen.queryByRole('article', { name: /Явір/ })).toBeNull());
    expect(window.location.search).toBe('?minCapacity=8');
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain(
      '/api/rooms?minCapacity=8',
    );
  });

  it('reads the filter back out of the URL on a deep link', async () => {
    renderRoomsPage('/?minCapacity=8', {
      'GET /api/rooms': allRooms,
      'GET /api/rooms?minCapacity=8': () => jsonResponse(200, { rooms: [OAK] }),
    });

    await screen.findByRole('article', { name: /Дуб/ });
    expect(screen.getByRole('radio', { name: 'від 8' }).getAttribute('aria-checked')).toBe('true');
  });

  it('moves between chips with the arrow keys', async () => {
    renderRoomsPage('/', {
      'GET /api/rooms': allRooms,
      'GET /api/rooms?minCapacity=4': () => jsonResponse(200, { rooms: [OAK, MAPLE, SYCAMORE] }),
    });
    await screen.findByRole('article', { name: /Дуб/ });

    fireEvent.keyDown(screen.getByRole('radio', { name: 'Будь-яка' }), { key: 'ArrowRight' });

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'від 4' }).getAttribute('aria-checked')).toBe(
        'true',
      ),
    );
  });
});

describe('empty state', () => {
  afterEach(resetHarness);

  it('names the largest room that does exist and clears the filter on «Показати всі»', async () => {
    renderRoomsPage('/', {
      'GET /api/rooms': allRooms,
      'GET /api/rooms?minCapacity=20': () => jsonResponse(200, { rooms: [] }),
    });
    await screen.findByRole('article', { name: /Дуб/ });

    fireEvent.click(screen.getByRole('radio', { name: 'від 20' }));

    await screen.findByText('Таких кімнат немає');
    const body = screen.getByText(/Найбільша переговорна/);
    expect(body.textContent).toContain('Дуб');
    expect(body.textContent).toContain('12');

    fireEvent.click(screen.getByRole('button', { name: 'Показати всі' }));

    await screen.findByRole('article', { name: /Явір/ });
    expect(window.location.search).toBe('');
  });
});

describe('loading state', () => {
  afterEach(resetHarness);

  it('exposes a status region with skeletons rather than a spinner', async () => {
    renderRoomsPage('/', { 'GET /api/rooms': () => new Promise(() => {}) });

    const status = await screen.findByRole('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByRole('progressbar')).toBeNull();
    // The layout is kept while loading, per the states rule.
    expect(screen.getByRole('heading', { name: 'Переговорні' })).toBeTruthy();
  });
});

describe('error state', () => {
  afterEach(resetHarness);

  it('offers both actions, disables the cached copy when there is none, and retries', async () => {
    let shouldFail = true;
    renderRoomsPage('/', {
      'GET /api/rooms': () =>
        shouldFail
          ? jsonResponse(500, { statusCode: 500, message: 'Internal server error' })
          : allRooms(),
    });

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Сервер не відповідає')).toBeTruthy();
    const cached = screen.getByRole('button', { name: 'Показати збережену копію' });
    expect((cached as HTMLButtonElement).disabled).toBe(true);

    shouldFail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Повторити' }));

    await screen.findByRole('article', { name: /Дуб/ });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the last successful list when «Показати збережену копію» is pressed', async () => {
    let shouldFail = false;
    renderRoomsPage('/', {
      'GET /api/rooms': () =>
        shouldFail
          ? jsonResponse(500, { statusCode: 500, message: 'Internal server error' })
          : allRooms(),
      'GET /api/rooms?minCapacity=4': () => jsonResponse(200, { rooms: [OAK] }),
    });
    await screen.findByRole('article', { name: /Дуб/ });

    // Force a refetch of the same key that fails, so the cache still holds a good list.
    shouldFail = true;
    fireEvent.click(screen.getByRole('radio', { name: 'від 4' }));
    await screen.findByRole('article', { name: /Дуб/ });
    fireEvent.click(screen.getByRole('radio', { name: 'Будь-яка' }));

    const alert = await screen.findByRole('alert');
    const cached = within(alert).getByRole('button', { name: 'Показати збережену копію' });
    expect((cached as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(cached);

    await screen.findByRole('article', { name: /Явір/ });
    expect(screen.getByText(/збережену копію/)).toBeTruthy();
  });
});

describe('response validation', () => {
  afterEach(resetHarness);

  it('treats a malformed room list as an error rather than rendering it', async () => {
    renderRoomsPage('/', {
      'GET /api/rooms': () => jsonResponse(200, { rooms: [{ id: 1, name: 'Дуб' }] }),
    });

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Сервер не відповідає')).toBeTruthy();
  });
});
