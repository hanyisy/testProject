import type { Metadata, Viewport } from 'next';
import '@/styles/app.css';

export const metadata: Metadata = {
  title: { default: '현장로그', template: '%s · 현장로그' },
  robots: { index: false, follow: false }
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

/* 라이트 · 나이트 테마 (설정에서 고름) — 그리기 전에 적용해서 깜빡임 없게 */
const themeBoot = `try{var t=localStorage.getItem('hl-theme');if(t==='dark')document.documentElement.dataset.theme='dark'}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
