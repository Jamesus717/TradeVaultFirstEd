// `npm run demo`: the app with example data and no database, on port 3100.
// Blanking the Supabase vars means a local .env.local can't reach production.
import { spawn } from 'node:child_process';

const env = {
  ...process.env,
  NEXT_PUBLIC_TB_DEMO: '1',
  NEXT_PUBLIC_SUPABASE_URL: '',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
};

const child = spawn('npx next dev --webpack -p 3100', { env, stdio: 'inherit', shell: true });
child.on('exit', (code) => process.exit(code ?? 0));
