import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const LOGO_EMAIL_CONTENT_ID = 'logo-maria-cristina';
export const LOGO_EMAIL_LARGURA = 88;
export const LOGO_EMAIL_ALTURA = 110;

// Usa o mesmo PNG transparente exibido no site.
export const LOGO_EMAIL_BASE64 = readFileSync(
  join(process.cwd(), 'public', 'maria-cristina-logo.png'),
).toString('base64');
