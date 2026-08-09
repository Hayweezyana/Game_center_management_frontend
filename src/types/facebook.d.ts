export {};

declare global {
  interface Window {
    fbq?: any;
    /** Set by the pixel loader in index.html when REACT_APP_META_PIXEL_ID is configured. */
    __META_PIXEL_ID__?: string;
  }
}
