/// <reference types="vite/client" />
import type { ReactNode } from 'react';
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import appCss from '../styles.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width,initial-scale=1,viewport-fit=cover' },
      { name: 'theme-color', content: '#0b1222' },
      { title: 'Bidule' },
      { name: 'description', content: "Des machines en 3D qu'on fait marcher pour comprendre comment elles fonctionnent. Pour les petits, dès la maternelle." }
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@600;700;800&display=swap' },
      { rel: 'stylesheet', href: appCss }
    ]
  }),
  shellComponent: RootDocument,
  component: Outlet
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
