export const logger = {
  info: (...args: unknown[]) => console.log('[RetroCare]', ...args),
  warn: (...args: unknown[]) => console.warn('[RetroCare]', ...args),
  error: (...args: unknown[]) => console.error('[RetroCare]', ...args),
};

