// Type declarations for A-Frame and AR.js
declare global {
  interface Window {
    AFRAME: any;
  }
}

declare module 'aframe' {
  const aframe: any;
  export default aframe;
}

declare module '@ar-js-org/ar.js' {
  const arjs: any;
  export default arjs;
}