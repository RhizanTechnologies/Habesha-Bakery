import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import { BranchProvider } from '../context/BranchContext';
import { LanguageProvider } from '../context/LanguageContext';
import QueryProvider from '../providers/QueryProvider';
import { AppShell } from '../components/AppShell';
import { Toaster } from '../components/ui/sonner';

export const viewport: Viewport = {
  themeColor: '#E87A18',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'Habesha Bakery ERP',
  description: 'Habesha Bakery Operations and Inventory Management System',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-[#FAF7EE] text-[#2C1B10]">
        <QueryProvider>
          <LanguageProvider>
            <AuthProvider>
              <BranchProvider>
                <AppShell>
                  {children}
                </AppShell>
                <Toaster />
              </BranchProvider>
            </AuthProvider>
          </LanguageProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
