'use client';

import { useEffect } from 'react';

/**
 * Component to handle browser extension compatibility
 * Suppresses hydration warnings from extensions like Grammarly
 */
export default function BrowserExtensionHandler() {
  useEffect(() => {
    // Handle Grammarly and other browser extension attributes
    const handleExtensionAttributes = () => {
      // Remove or handle Grammarly attributes that cause hydration issues
      const body = document.body;
      const html = document.documentElement;
      
      // List of known extension attributes that cause hydration warnings
      const extensionAttributes = [
        'data-new-gr-c-s-check-loaded',
        'data-gr-ext-installed',
        'data-new-gr-c-s-loaded',
        'cz-shortcut-listen'
      ];
      
      // Function to clean attributes
      const cleanElement = (element: Element) => {
        extensionAttributes.forEach(attr => {
          if (element.hasAttribute(attr)) {
            element.removeAttribute(attr);
          }
        });
      };
      
      // Clean existing attributes
      cleanElement(html);
      cleanElement(body);
      
      // Watch for dynamic attribute changes
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes') {
            const target = mutation.target as Element;
            const attrName = mutation.attributeName;
            
            if (attrName && extensionAttributes.includes(attrName)) {
              target.removeAttribute(attrName);
            }
          }
        });
      });
      
      // Start observing
      observer.observe(html, { 
        attributes: true, 
        attributeFilter: extensionAttributes 
      });
      observer.observe(body, { 
        attributes: true, 
        attributeFilter: extensionAttributes 
      });
      
      // Cleanup on unmount
      return () => observer.disconnect();
    };
    
    // Run after a short delay to let extensions load
    const timeoutId = setTimeout(handleExtensionAttributes, 100);
    
    return () => clearTimeout(timeoutId);
  }, []);
  
  return null; // This component doesn't render anything
}