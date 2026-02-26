import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Dashboard Operacional',
  description: 'Sistema web moderno com dashboard de KPIs, integrações de APIs e análises avançadas.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased" suppressHydrationWarning>
        {children}
        {/* O Toaster fica aqui no final para renderizar as notificações em qualquer parte do sistema */}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}