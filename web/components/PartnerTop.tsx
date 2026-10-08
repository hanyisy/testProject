/* 파트너 관리자 상단 줄 (시안 2a): 화면 이름 + 오른쪽 버튼들. 모바일에서는 화면 이름만 본문 위에 */
import type { ReactNode } from 'react';

export default function PartnerTop({ title, actions, mobileTitle = true }: { title: string; actions?: ReactNode; mobileTitle?: boolean }) {
  return (
    <header className={'ptop' + (mobileTitle ? '' : ' ptop--mhide')}>
      <h1 className="ptop__title">{title}</h1>
      {actions && <div className="ptop__actions">{actions}</div>}
    </header>
  );
}
