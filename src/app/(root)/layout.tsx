import type { ReactNode } from 'react';

// Root "/" only: a tiny document that forwards to the player's language.
export default function RootRedirectLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
