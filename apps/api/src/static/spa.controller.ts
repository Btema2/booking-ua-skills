import { existsSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { All, Controller, Inject, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

export const PUBLIC_DIR = Symbol('PUBLIC_DIR');

// req.path is never percent-decoded here, so encoded traversal (e.g. %2e%2e%2f) is
// just an inert literal segment to resolve() — this only guards literal `..` segments.
function resolveWithinPublicDir(publicDir: string, requestPath: string): string | null {
  const resolved = resolve(publicDir, `.${requestPath}`);
  if (resolved !== publicDir && !resolved.startsWith(publicDir + sep)) {
    return null;
  }
  return resolved;
}

@Controller()
export class SpaController {
  constructor(@Inject(PUBLIC_DIR) private readonly publicDir: string) {}

  @All('*')
  handle(@Req() req: Request, @Res() res: Response): void {
    if (req.path.startsWith('/api')) {
      res.status(404).json({ statusCode: 404, message: 'Not Found', path: req.path });
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
