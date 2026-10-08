import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // PGlite는 WASM 파일을 직접 읽어서 번들에서 뺍니다
  serverExternalPackages: ['@electric-sql/pglite'],
  /* 사진 올리기: 한 장 15MB까지 */
  experimental: { serverActions: { bodySizeLimit: '16mb' } },
  /* 공개 랜딩(public/landing): 폴더 주소는 index.html 로 */
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [{ source: '/landing/', destination: '/landing/index.html' }];
  },
  async headers() {
    // 컨펌용 임시 주소: 전부 색인 제외 (도메인 연결 때 공개 페이지만 해제)
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }];
  }
};

export default nextConfig;
