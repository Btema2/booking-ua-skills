import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expectFieldError, jsonResponse, renderApp, resetHarness } from '../../test/harness';

const anonymousSession = () =>
  jsonResponse(401, { statusCode: 401, message: 'Необхідна автентифікація' });

async function fillLoginForm() {
  fireEvent.change(await screen.findByLabelText(/Email|Електронна пошта/i), {
    target: { value: 'ivan@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'super-secret' } });
  fireEvent.click(screen.getByRole('button', { name: 'Увійти' }));
}

describe('client-side validation', () => {
  afterEach(resetHarness);

  it('rejects a 7-character password without sending a request', async () => {
    const { fetchMock } = renderApp('/register', { 'GET /api/auth/me': anonymousSession });
    await screen.findByRole('heading', { name: 'Створіть акаунт' });
    const callsBeforeSubmit = fetchMock.mock.calls.length;

    fireEvent.change(screen.getByLabelText('Імʼя'), { target: { value: 'Іван' } });
    fireEvent.change(screen.getByLabelText(/Email|Електронна пошта/i), { target: { value: 'ivan@example.com' } });
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: '1234567' } });
    fireEvent.click(screen.getByRole('button', { name: 'Зареєструватися' }));

    await waitFor(() =>
      expectFieldError(
        screen.getByLabelText('Пароль'),
        'Пароль має містити щонайменше 8 символів',
      ),
    );
    expect(fetchMock.mock.calls.length).toBe(callsBeforeSubmit);
  });
});

describe('server-side errors', () => {
  afterEach(resetHarness);

  it('shows a 400 field error under the matching input and keeps the typed values', async () => {
    renderApp('/login', {
      'GET /api/auth/me': anonymousSession,
      'POST /api/auth/login': () =>
        jsonResponse(400, {
          statusCode: 400,
          errors: { email: ['Цей email заблоковано'] },
        }),
    });
    await fillLoginForm();

    await waitFor(() =>
      expectFieldError(screen.getByLabelText(/Email|Електронна пошта/i), 'Цей email заблоковано'),
    );
    expect((screen.getByLabelText(/Email|Електронна пошта/i) as HTMLInputElement).value).toBe('ivan@example.com');
    expect((screen.getByLabelText('Пароль') as HTMLInputElement).value).toBe('super-secret');
  });

  it('shows a 401 message as a form-level error rather than on a field', async () => {
    renderApp('/login', {
      'GET /api/auth/me': anonymousSession,
      'POST /api/auth/login': () =>
        jsonResponse(401, { statusCode: 401, message: 'Невірний email або пароль' }),
    });
    await fillLoginForm();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Невірний email або пароль');
    expect(screen.getByLabelText(/Email|Електронна пошта/i).getAttribute('aria-invalid')).toBeNull();
  });
});

