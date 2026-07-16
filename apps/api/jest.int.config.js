/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.int-spec.ts'],
  setupFiles: ['<rootDir>/test/set-env.ts'],
  globalSetup: '<rootDir>/test/global-setup.ts',
  globalTeardown: '<rootDir>/test/global-teardown.ts',
  testTimeout: 60000,
  // No forceExit: the API and worker close all BullMQ, Redis and PG handles on
  // shutdown, so the process exits cleanly on its own. detectOpenHandles helps
  // catch regressions if a new connection is ever left open.
  detectOpenHandles: false,
};
