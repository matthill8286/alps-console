import { cleanup } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { resetCache } from '../data/cache';
import { handlers } from '../mocks/handlers';

// Tests override the handlers they rely on, so nothing depends on the mock's random delays.
export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetCache();
});
afterAll(() => server.close());
