// `npm run demo`: the app with example data and no database, on port 3100
// (or DEMO_PORT, e.g. DEMO_PORT=3111 to run beside another demo).
// Blanking the Supabase vars means a local .env.local can't reach production.
import { spawn } from 'node:child_process';

const env = {
  ...process.env,
  NEXT_PUBLIC_TB_DEMO: '1',
  NEXT_PUBLIC_SUPABASE_URL: '',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
};

const port = process.env.DEMO_PORT || '3100';
const child = spawn(`npx next dev --webpack -p ${port}`, { env, stdio: 'inherit', shell: true });
child.on('exit', (code) => process.exit(code ?? 0));
