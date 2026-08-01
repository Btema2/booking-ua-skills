import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Request, Response } from 'express';
import { SpaController } from './spa.controller';

function fakeRequest(path: string): Request {
  return { path } as Request;
}

function fakeResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    sendFile: jest.fn(),
  } as unknown as Response & {
    status: jest.Mock;
    json: jest.Mock;
    sendFile: jest.Mock;
  };
}

describe('SpaController', () => {
  let publicDir: string;
  let controller: SpaController;

  beforeAll(() => {
    publicDir = mkdtempSync(join(tmpdir(), 'spa-controller-test-'));
    writeFileSync(join(publicDir, 'index.html'), '<!doctype html><title>App</title>');
    writeFileSync(join(publicDir, 'app.js'), 'console.log("asset")');
    controller = new SpaController(publicDir);
  });

  afterAll(() => {
    rmSync(publicDir, { recursive: true, force: true });
  });

  it('serves a real static asset by path', () => {
    const res = fakeResponse();
    controller.handle(fakeRequest('/app.js'), res);
    expect(res.sendFile).toHaveBeenCalledWith(join(publicDir, 'app.js'));
  });

  it('falls back to index.html for an unmatched non-api deep link', () => {
    const res = fakeResponse();
    controller.handle(fakeRequest('/rooms/1'), res);
    expect(res.sendFile).toHaveBeenCalledWith(join(publicDir, 'index.html'));
  });

  it('returns JSON 404 for an unmatched /api/* path', () => {
    const res = fakeResponse();
    controller.handle(fakeRequest('/api/does-not-exist'), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      statusCode: 404,
      message: 'Not Found',
      path: '/api/does-not-exist',
    });
  });

  it('refuses to serve a path that traverses outside publicDir', () => {
    const res = fakeResponse();
    controller.handle(fakeRequest('/../../../../etc/passwd'), res);
    expect(res.sendFile).toHaveBeenCalledWith(join(publicDir, 'index.html'));
  });
});
