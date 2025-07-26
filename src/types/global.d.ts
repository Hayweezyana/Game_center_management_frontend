// src/types/global.d.ts
export {};

declare global {
  interface Window {
    pcLock: {
      get: () => boolean;
      set: (val: boolean) => void;
      subscribe: (callback: (val: boolean) => void) => void;
    };
  }
}
