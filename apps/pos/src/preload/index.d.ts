import type { MvApi } from './index';

declare global {
  interface Window {
    mv: MvApi;
  }
}

export {};
