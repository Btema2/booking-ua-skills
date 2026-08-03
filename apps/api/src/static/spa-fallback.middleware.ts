import { existsSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { PUBLIC_DIR } from './public-dir';

// req.path is never percent-decoded here, so encoded traversal (e.g. %2e%2e%2f) is
// just an inert literal segment to resolve() — this only guards literal `..` segments.
function resolveWithinPublicDir(publicDir: string, requestPath: string): string | null {
  const resolved = resolve(publicDir, `.${requestPath}`);
  if (resolved !== publicDir && !resolved.startsWith(publicDir + sep)) {
    return null;
  }
  return resolved;
}

/**
 * Serves the built SPA for browser navigations, as middleware rather than a controller.
 *
 * Why middleware instead of a `@All('*')` controller (the previous shape) or
 * `@nestjs/serve-static` with `exclude: ['/api/{*path}']`:
 *
 * - Middleware registers no route, so it cannot shadow a controller. A wildcard controller
 *   competes in Nest's route table, where the first match wins and matching follows module
 *   registration order — which is why AuthController had to be hoisted into AppModule. Feature
 *   modules (rooms, bookings, notifications) can now be imported in any position.
 * - Everything under /api is handed straight back to `next()`, so an unknown API path falls
 *   through to Nest's own not-found handler and answers JSON, not index.html.
 * - `@nestjs/serve-static` would express the same /api bypass through its `exclude` option, but
 *   costs a dependency and puts a second static-file implementation beside the traversal guard
 *   below, which is already covered by tests here.
 */
@Injectable()
export class SpaFallbackMiddleware implements NestMiddleware {
  constructor(@Inject(PUBLIC_DIR) private readonly publicDir: string) {}

  use(req: Request, res: Response, next: NextFunction): void {
    if (req.path.startsWith('/api')) {
      next();
      return;
    }

    const requestedAsset = resolveWithinPublicDir(this.publicDir, req.path);
    if (requestedAsset && req.path !== '/' && existsSync(requestedAsset)) {
      res.sendFile(relative(this.publicDir, requestedAsset), { root: this.publicDir });
      return;
    }

    res.sendFile('index.html', { root: this.publicDir });
  }
}
