/* 목록 상태 (공용 하나): 빈 상태 · 불러오는 중 · 불러오기 실패 + 다시 시도
 * 서버에서 그리는 목록은 빈 상태를, 불러오는 중은 각 화면 loading.tsx, 실패는 error.tsx 에서 이 컴포넌트를 씁니다. */
import type { ReactNode } from 'react';

type Props =
  | { kind: 'empty'; title: string; desc?: string; action?: ReactNode }
  | { kind: 'loading'; rows?: number }
  | { kind: 'error'; title?: string; desc?: string; retry?: ReactNode };

export default function ListState(p: Props) {
  if (p.kind === 'loading') {
    return (
      <div className="lstate" role="status" aria-label="불러오는 중">
        {Array.from({ length: p.rows ?? 4 }, (_, i) => <span key={i} className="skel" style={{ width: `${90 - i * 12}%` }} />)}
      </div>
    );
  }
  if (p.kind === 'error') {
    return (
      <div className="lstate lstate--error" role="alert">
        <span className="lstate__icon" aria-hidden="true">!</span>
        <span className="lstate__title">{p.title ?? '목록을 불러오지 못했어요'}</span>
        <span className="lstate__desc">{p.desc ?? '잠시 후 다시 시도해 주세요'}</span>
        {p.retry}
      </div>
    );
  }
  return (
    <div className="lstate">
      <span className="lstate__icon" aria-hidden="true">–</span>
      <span className="lstate__title">{p.title}</span>
      {p.desc && <span className="lstate__desc">{p.desc}</span>}
      {p.action}
    </div>
  );
}
