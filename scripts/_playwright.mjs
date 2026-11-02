import { createRequire } from 'node:module';
import { resolve } from 'node:path';

export function loadPlaywright() {
  const projectRoot = process.env.UX_UI_PROJECT_ROOT || process.cwd();
  const require = createRequire(resolve(projectRoot, 'package.json'));
  return require('playwright');
}
