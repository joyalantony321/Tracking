import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import BrowserExtensionHandler from '@/components/BrowserExtensionHandler';
import ClientErrorBoundary from '@/components/ClientErrorBoundary';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Campus Navigation System',
  description: 'Smart campus navigation with real-time GPS tracking',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Suppress specific browser extension hydration warnings
              const originalConsoleWarn = console.warn;
              console.warn = function(...args) {
                const message = args.join(' ');
                const isExtensionWarning = message.includes('Extra attributes from the server') ||
                                         message.includes('data-new-gr-c-s-check-loaded') ||
                                         message.includes('data-gr-ext-installed') ||
                                         message.includes('data-new-gr-c-s-loaded');
                
                if (!isExtensionWarning) {
                  originalConsoleWarn.apply(console, args);
                }
              };
            `,
          }}
        />
      </head>
      <body 
        className={inter.className}
        suppressHydrationWarning
      >
        <BrowserExtensionHandler />
        <ClientErrorBoundary>
          {children}
        </ClientErrorBoundary>
      </body>
    </html>
  );
}