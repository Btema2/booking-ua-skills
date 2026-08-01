const { cpSync, existsSync, rmSync } = require('node:fs');
const { join } = require('node:path');

const webDist = join(__dirname, '..', 'apps', 'web', 'dist');
const apiPublicDir = join(__dirname, '..', 'apps', 'api', 'dist', 'public');

if (!existsSync(webDist)) {
  console.error(`Expected web build output at ${webDist}, but it does not exist.`);
  process.exit(1);
}

rmSync(apiPublicDir, { recursive: true, force: true });
cpSync(webDist, apiPublicDir, { recursive: true });

console.log(`Copied ${webDist} -> ${apiPublicDir}`);
