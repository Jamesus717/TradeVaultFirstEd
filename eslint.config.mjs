import { globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  // Build output and local worktrees, not source.
  globalIgnores(['.next/**', '.open-next/**', '.wrangler/**', '.claude/**', 'out/**', 'next-env.d.ts']),
];

export default eslintConfig;
