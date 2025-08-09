import './globals.css';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import { AuthContextProvider } from '@/context/AuthContext';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata = {
  title: 'Ai Resume Parser',
  description: 'Ai Resume Parser by MFH',
  icons: {
    icon: '/assets/favicon.ico',
    shortcut: '/assets/favicon.ico',
    apple: '/assets/favicon.ico',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.className}>
      <body style={{ margin: 0, backgroundColor: '#f5f5f5' }}>
        <Providers>
          <AuthContextProvider>
            {children}
          </AuthContextProvider>
        </Providers>
      </body>
    </html>
  );
}
