/* 요청마다 지금 주소를 x-pathname 헤더로 넘김 — 로그인 뒤 돌아올 곳(next)에 씀 */
import { NextResponse, type NextRequest } from 'next/server';

export function proxy(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set('x-pathname', req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ['/admin/:path*', '/partner/:path*', '/login/:path*', '/forbidden'] };
