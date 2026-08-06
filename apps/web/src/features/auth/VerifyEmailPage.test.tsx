import { afterEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { jsonResponse, renderApp, resetHarness } from '../../test/harness';

describe('VerifyEmailPage', () => {
  afterEach(resetHarness);

  it('shows a success message and calls the verify endpoint once', async () => {
    let callCount = 0;
    renderApp('/verify/some-token', {
      'GET /api/auth/me': () => jsonResponse(200, { user: null }),
      'POST /api/auth/verify/some-token': () => {
        callCount += 1;
        return jsonResponse(200, { success: true });
      },
    });

    expect(await screen.findByText('Пошту підтверджено. Тепер можна створювати бронювання.')).toBeTruthy();
    expect(callCount).toBe(1);
  });

  it('shows the server error message for an invalid or expired token', async () => {
    renderApp('/verify/bad-token', {
      'GET /api/auth/me': () => jsonResponse(200, { user: null }),
      'POST /api/auth/verify/bad-token': () =>
        jsonResponse(400, { message: 'Токен підтвердження недійсний або прострочений' }),
    });

    expect(await screen.findByText('Токен підтвердження недійсний або прострочений')).toBeTruthy();
  });

  it('offers a link to rooms for an already-signed-in user, login otherwise', async () => {
    renderApp('/verify/some-token', {
      'GET /api/auth/me': () =>
        jsonResponse(200, {
          user: { id: '1', name: 'Іван', email: 'ivan@x.com', emailVerifiedAt: null },
        }),
      'POST /api/auth/verify/some-token': () => jsonResponse(200, { success: true }),
    });

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'До кімнат' })).toBeTruthy();
    });
  });
});
