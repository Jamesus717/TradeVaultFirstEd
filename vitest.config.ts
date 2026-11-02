import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Each database file boots its own embedded Postgres.
    testTimeout: 60000,
    hookTimeout: 120000,
    pool: 'forks',
  },
});
