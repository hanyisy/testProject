'use client';
/* 목록 위 드롭다운 필터 (시안 "접수일 최근 30일 ▼" · "담당 전체 ▼") — 고르면 주소 쿼리를 바꿈 */
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function FilterSelect({ name, label, options, value }: { name: string; label: string; options: { value: string; label: string }[]; value: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  return (
    <label className="dd">
      <span className="dd__k">{label}</span>
      <select
        value={value}
        onChange={(e) => {
          const q = new URLSearchParams(sp.toString());
          if (e.target.value) q.set(name, e.target.value); else q.delete(name);
          q.delete('page');
          router.push(`${path}?${q.toString()}`);
        }}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
