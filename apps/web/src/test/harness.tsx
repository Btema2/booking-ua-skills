import { cleanup, render } from '@testing-library/react';
import { expect, vi } from 'vitest';
import { App } from '../App';

/**
 * Minimal duck-typed stand-in for `Response`: `apiRequest` only reads `ok`,
 * `status` and `json()`, so this avoids depending on a fetch polyfill in jsdom.
 */
type StubResponse = { ok: boolean; status: number; json: () => Promise<unknown> };

/** Handlers are keyed by `"<METHOD> <url>"`, e.g. `"POST /api/auth/login"`. */
export type RouteHandlers = Readonly<Record<string, () => StubResponse>>;

export function jsonResponse(status: number, body: unknown): StubResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

export function renderApp(path: string, handlers: RouteHandlers) {
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
  render(<App />);
  return { fetchMock };
}

export function resetHarness() {
  cleanup();
  vi.unstubAllGlobals();
  window.history.pushState({}, '', '/');
}

/**
 * Asserts the message is rendered as the field's own accessible description,
 * which is what "shown under the right field" has to mean for a screen reader.
 */
export function expectFieldError(input: HTMLElement, message: string) {
  expect(input.getAttribute('aria-invalid')).toBe('true');
  const describedBy = input.getAttribute('aria-describedby');
  expect(describedBy).toBeTruthy();
  const description = document.getElementById(String(describedBy));
  expect(description?.textContent).toBe(message);
  expect(description?.getAttribute('role')).toBe('alert');
}
