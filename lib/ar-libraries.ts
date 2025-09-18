/**
 * AR Libraries Management Utility
 * Handles safe loading of A-Frame and AR.js to prevent CustomElementRegistry conflicts
 */

declare global {
  interface Window {
    AFRAME: any;
    THREEx: any;
    __AR_LIBRARIES_LOADED: boolean;
    __AR_LIBRARIES_LOADING: Promise<void> | null;
  }
}

let loadingPromise: Promise<void> | null = null;

/**
 * Safely load AR libraries (A-Frame and AR.js) only once
 * Prevents CustomElementRegistry conflicts by checking if elements are already registered
 */
export async function loadARLibraries(): Promise<void> {
  // If already loaded, return immediately
  if (window.__AR_LIBRARIES_LOADED) {
    console.log('AR libraries already loaded');
    return;
  }

  // If currently loading, wait for existing promise
  if (loadingPromise) {
    console.log('AR libraries loading in progress, waiting...');
    return loadingPromise;
  }

  // Create new loading promise
  loadingPromise = new Promise<void>(async (resolve, reject) => {
    try {
      console.log('Starting AR libraries loading process...');

      // Check if A-Frame is already registered in CustomElementRegistry
      const aframeAlreadyRegistered = customElements.get('a-scene') !== undefined;
      
      if (!aframeAlreadyRegistered && !window.AFRAME) {
        console.log('Loading A-Frame...');
        await import('aframe');
        
        // Wait for A-Frame to fully initialize
        await waitForAFrame();
        console.log('A-Frame loaded and initialized');
      } else {
        console.log('A-Frame already available');
      }

      // Check if AR.js is already loaded
      if (!window.THREEx) {
        console.log('Loading AR.js...');
        await import('@ar-js-org/ar.js' as any);
        
        // Wait for AR.js to fully initialize
        await waitForARJS();
        console.log('AR.js loaded and initialized');
      } else {
        console.log('AR.js already available');
      }

      // Mark as loaded
      window.__AR_LIBRARIES_LOADED = true;
      console.log('All AR libraries loaded successfully');
      
      resolve();
    } catch (error) {
      console.error('Failed to load AR libraries:', error);
      reject(error);
    } finally {
      // Clear loading promise
      loadingPromise = null;
    }
  });

  return loadingPromise;
}

/**
 * Wait for A-Frame to be fully initialized
 */
function waitForAFrame(): Promise<void> {
  return new Promise((resolve) => {
    const checkAFrame = () => {
      if (window.AFRAME && 
          window.AFRAME.registerComponent && 
          customElements.get('a-scene')) {
        resolve();
      } else {
        setTimeout(checkAFrame, 50);
      }
    };
    checkAFrame();
  });
}

/**
 * Wait for AR.js to be fully initialized
 */
function waitForARJS(): Promise<void> {
  return new Promise((resolve) => {
    const checkARJS = () => {
      if (window.THREEx && window.THREEx.ArToolkitContext) {
        resolve();
      } else {
        setTimeout(checkARJS, 50);
      }
    };
    checkARJS();
  });
}

/**
 * Check if AR libraries are ready to use
 */
export function areARLibrariesReady(): boolean {
  return window.__AR_LIBRARIES_LOADED === true &&
         window.AFRAME !== undefined &&
         window.THREEx !== undefined &&
         customElements.get('a-scene') !== undefined;
}

/**
 * Reset library loading state (useful for testing)
 */
export function resetARLibraries(): void {
  window.__AR_LIBRARIES_LOADED = false;
  loadingPromise = null;
}