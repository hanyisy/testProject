'use client';
/* 진행 중인 상태(연결 확인 · 생성 중 등)를 보여 주는 동안 화면을 주기적으로 새로 그림 */
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AutoRefresh({ every = 1000 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), every);
    return () => clearInterval(t);
  }, [router, every]);
  return null;
}
