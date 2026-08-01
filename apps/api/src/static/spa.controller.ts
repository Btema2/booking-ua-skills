import { existsSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { All, Controller, Inject, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

export const PUBLIC_DIR = Symbol('PUBLIC_DIR');

// Rejects requestPath segments that would resolve outside publicDir (e.g. `/../../etc/passwd`).
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
      res.sendFile(requestedAsset);
      return;
    }

    res.sendFile(join(this.publicDir, 'index.html'));
  }
}
