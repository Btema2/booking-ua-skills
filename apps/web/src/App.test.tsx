import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { jsonResponse, renderApp, resetHarness } from './test/harness';

const IVAN = {
  id: '1f2ac0d6-8d61-4a2f-9f5c-7b2b6c0a1d31',
  name: 'Іван',
  email: 'ivan@example.com',
  emailVerifiedAt: null,
};

const anonymousSession = () =>
  jsonResponse(401, { statusCode: 401, message: 'Необхідна автентифікація' });

const activeSession = () => jsonResponse(200, { user: IVAN });

/** A session check that never settles, so the app stays in its loading state. */
const pendingSession = () => ({ ok: true, status: 200, json: () => new Promise<unknown>(() => {}) });

/** The landing route is the room list, so every test that reaches `/` needs it. */
const emptyRoomList = () => jsonResponse(200, { rooms: [] });

describe('routing', () => {
  afterEach(resetHarness);

  it('holds the layout with a skeleton instead of flashing the login screen', async () => {
    renderApp('/login', { 'GET /api/auth/me': pendingSession });

    expect(await screen.findByRole('status', { name: 'Завантаження' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Вхід' })).toBeNull();
  });

  it('sends an unauthenticated visitor from / to the login screen', async () => {
    renderApp('/', { 'GET /api/auth/me': anonymousSession });

    expect(await screen.findByRole('heading', { name: 'Вхід' })).toBeTruthy();
    expect(window.location.pathname).toBe('/login');
  });

  it('redirects an unknown path to the authenticated landing', async () => {
    renderApp('/такого-шляху-немає', {
      'GET /api/auth/me': activeSession,
      'GET /api/rooms': emptyRoomList,
    });

    expect(await screen.findByRole('heading', { name: 'Переговорні' })).toBeTruthy();
    expect(window.location.pathname).toBe('/');
  });

  it('keeps an authenticated visitor off the login screen', async () => {
    renderApp('/login', {
      'GET /api/auth/me': activeSession,
      'GET /api/rooms': emptyRoomList,
    });

    expect(await screen.findByRole('heading', { name: 'Переговорні' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Вхід' })).toBeNull();
  });
});

describe('app bar navigation', () => {
  afterEach(resetHarness);

  it('marks the tab of the current screen with aria-current="page"', async () => {
    renderApp('/', {
      'GET /api/auth/me': activeSession,
      'GET /api/rooms': emptyRoomList,
    });

    const roomsTab = await screen.findByRole('link', { name: 'Кімнати' });
    expect(roomsTab.getAttribute('aria-current')).toBe('page');
  });

  it('points the Кімнати tab at the room list', async () => {
    renderApp('/', {
      'GET /api/auth/me': activeSession,
      'GET /api/rooms': emptyRoomList,
    });

    const nav = await screen.findByRole('navigation', { name: 'Головна навігація' });
    expect(within(nav).getByRole('link', { name: 'Кімнати' }).getAttribute('href')).toBe('/');
  });

  it('points the Мої бронювання tab at /my-bookings', async () => {
    renderApp('/', {
      'GET /api/auth/me': activeSession,
      'GET /api/rooms': emptyRoomList,
    });

    const nav = await screen.findByRole('navigation', { name: 'Головна навігація' });
    const tab = within(nav).getByRole('link', { name: 'Мої бронювання' });

    expect(tab.getAttribute('href')).toBe('/my-bookings');
  });
});

describe('session lifecycle', () => {
  afterEach(resetHarness);

  it('renders the authenticated landing with the user name after a successful login', async () => {
    renderApp('/login', {
      'GET /api/auth/me': anonymousSession,
      'POST /api/auth/login': activeSession,
      'GET /api/rooms': emptyRoomList,
    });

    fireEvent.change(await screen.findByLabelText('Email'), {
      target: { value: 'ivan@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'super-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Увійти' }));

    expect(await screen.findByRole('heading', { name: 'Переговорні' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Вийти' })).toBeTruthy();
  });

  it('returns to the login screen after logging out', async () => {
    renderApp('/', {
      'GET /api/auth/me': activeSession,
      'GET /api/rooms': emptyRoomList,
      'POST /api/auth/logout': () => jsonResponse(204, null),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Вийти' }));

    expect(await screen.findByRole('heading', { name: 'Вхід' })).toBeTruthy();
    expect(window.location.pathname).toBe('/login');
  });
});
