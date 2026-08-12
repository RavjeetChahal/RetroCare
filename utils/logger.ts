const prefix = '[RetroCare]';

const isDevEnvironment = (() => {
  if (typeof globalThis !== 'undefined' && typeof (globalThis as any).__DEV__ === 'boolean') {
    return (globalThis as any).__DEV__;
  }
  if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
    return process.env.NODE_ENV !== 'production';
  }
  return false;
})();

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDevEnvironment) {
      console.log(`${prefix}[debug]`, ...args);
    }
  },
  info: (...args: unknown[]) => console.log(prefix, ...args),
  warn: (...args: unknown[]) => console.warn(prefix, ...args),
  error: (...args: unknown[]) => console.error(prefix, ...args),
};

