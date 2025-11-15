import { Buffer } from 'buffer';

export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  if (typeof globalThis.btoa === 'function') {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      const slice = bytes.subarray(i, i + chunk);
      binary += String.fromCharCode(...slice);
    }
    return globalThis.btoa(binary);
  }

  return Buffer.from(bytes).toString('base64');
};

