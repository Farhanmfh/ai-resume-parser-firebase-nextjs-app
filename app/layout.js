import './globals.css';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import { AuthContextProvider } from '@/context/AuthContext';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata = {
  title: 'AI Resume Parser',
  description: 'AI Resume Parser by MFH',
  icons: {
    icon: '/assets/favicon.ico',
    shortcut: '/assets/favicon.ico',
    apple: '/assets/favicon.ico',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.className}>
      <body style={{ margin: 0}}>
        <Providers>
          <AuthContextProvider>
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
              <NavBar />
              <main style={{ flex: 1 }}>{children}</main>
              <Footer />
            </div>
          </AuthContextProvider>
        </Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Prevent scroll restoration on page refresh
              if ('scrollRestoration' in history) {
                history.scrollRestoration = 'manual';
              }
              
              // Ensure page starts at top on refresh
              window.addEventListener('load', function() {
                window.scrollTo(0, 0);
              });
            `,
          }}
        />
      </body>
    </html>
  );
}
