import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { SpaFallbackMiddleware } from './spa-fallback.middleware';

function fakeRequest(path: string): Request {
  return { path } as Request;
}

function fakeResponse() {
  return { sendFile: jest.fn() } as unknown as Response & { sendFile: jest.Mock };
}

describe('SpaFallbackMiddleware', () => {
  let publicDir: string;
  let middleware: SpaFallbackMiddleware;
  let next: jest.MockedFunction<NextFunction>;

  beforeAll(() => {
    publicDir = mkdtempSync(join(tmpdir(), 'spa-fallback-test-'));
    writeFileSync(join(publicDir, 'index.html'), '<!doctype html><title>App</title>');
    writeFileSync(join(publicDir, 'app.js'), 'console.log("asset")');
    middleware = new SpaFallbackMiddleware(publicDir);
  });

  afterAll(() => {
    rmSync(publicDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    next = jest.fn();
  });

  it('serves a real static asset by path', () => {
    const res = fakeResponse();
    middleware.use(fakeRequest('/app.js'), res, next);
    expect(res.sendFile).toHaveBeenCalledWith('app.js', { root: publicDir });
    expect(next).not.toHaveBeenCalled();
  });

  it('falls back to index.html for an unmatched non-api deep link', () => {
    const res = fakeResponse();
    middleware.use(fakeRequest('/rooms/1'), res, next);
    expect(res.sendFile).toHaveBeenCalledWith('index.html', { root: publicDir });
    expect(next).not.toHaveBeenCalled();
  });

  it('hands every /api path back to the router instead of answering it', () => {
    const res = fakeResponse();
    middleware.use(fakeRequest('/api/does-not-exist'), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.sendFile).not.toHaveBeenCalled();
  });

  it('refuses to serve a path that traverses outside publicDir', () => {
    const res = fakeResponse();
    middleware.use(fakeRequest('/../../../../etc/passwd'), res, next);
    expect(res.sendFile).toHaveBeenCalledWith('index.html', { root: publicDir });
  });
});
