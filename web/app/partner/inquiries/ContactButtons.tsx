'use client';
/* 문의 고객에게 전화 · 문자 — 누르면 진행 기록에 남기고 휴대폰 전화/문자 앱을 엶 */
import Link from 'next/link';
import { logContact } from './actions';

type Props = { id: string; phone: string | null; smsText: string; isNew?: boolean; detail?: boolean; size?: 'm' | '' };

export default function ContactButtons({ id, phone, smsText, isNew, detail, size = '' }: Props) {
  const num = phone?.replace(/[^0-9+]/g, '') ?? '';
  const m = size === 'm' ? ' callbtn--m' : '';
  return (
    <span className="ibtns">
      <a href={num ? `tel:${num}` : undefined} aria-disabled={!num} className={'callbtn' + m + (isNew ? ' is-new' : '')} onClick={() => num && logContact(id, '전화')}>전화</a>
      <a href={num ? `sms:${num}?&body=${encodeURIComponent(smsText)}` : undefined} aria-disabled={!num} className={'callbtn callbtn--line' + m} onClick={() => num && logContact(id, '문자')}>문자</a>
      {detail && <Link href={`/partner/inquiries/${id}`} className={'callbtn callbtn--ghost' + m} aria-label="문의 자세히 보기">자세히</Link>}
    </span>
  );
}
