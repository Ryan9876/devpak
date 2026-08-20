import type { ReactNode } from 'react';
import './styles.css';
import './photo-landing.css';

export const metadata = { title: 'NestMetric', description: 'Functional room photo augmentation with measured geometry underneath.' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <a className="brand" href="/">NestMetric</a>
          <nav><a href="/studio">Studio</a><a href="/login">Sign in</a></nav>
        </header>
        {children}
      </body>
    </html>
  );
}
