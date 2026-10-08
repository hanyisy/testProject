import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // PGlite는 WASM 파일을 직접 읽어서 번들에서 뺍니다
  serverExternalPackages: ['@electric-sql/pglite'],
  async headers() {
    // 컨펌용 임시 주소: 전부 색인 제외 (도메인 연결 때 공개 페이지만 해제)
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }];
  }
};

export default nextConfig;
