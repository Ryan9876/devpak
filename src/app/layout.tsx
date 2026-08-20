import type { ReactNode } from 'react';
import './styles.css';
import './projects.css';
import './object-tools.css';
import './evidence.css';

export const metadata = { title: 'NestMetric', description: 'Plan spaces with verified dimensions.' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <a className="brand" href="/">NestMetric</a>
          <nav><a href="/projects">Projects</a><a href="/studio">Studio</a><a href="/login">Sign in</a></nav>
        </header>
        {children}
      </body>
    </html>
  );
}
