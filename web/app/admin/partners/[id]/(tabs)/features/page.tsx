import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePerm } from '@/lib/auth';
import { can as can_ } from '@/lib/permissions';
import { partnerDetail } from '@/lib/partners';
import { BLOG_MODES, COUNTRIES, DOMESTIC, FEATURES, LANGS, ML_SCOPE, TIERS } from '@/lib/constants';
import type { Features } from '@/db/schema';
import { setFeature, setMl } from '../../../actions';

export const metadata = { title: '파트너 · 기능 스위치' };

const shown = (k: string, v: unknown) => (k === 'blog' ? String(v) : v ? '켜짐' : '꺼짐');

/* 시안 3d — 기능 스위치 */
export default async function FeaturesPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePerm('파트너 관리');
  const { id } = await params;
  const d = await partnerDetail(id);
  if (!d) notFound();
  const f = d.features;
  const can = can_(user.role, '파트너 관리');
  const ml = f.mlConfig ?? { langs: [], countries: {}, regions: [], scope: '지역 + 가이드' };
  const langsOn = LANGS.filter((l) => ml.langs.includes(l));
  /* 번역할 지역: 서비스 지역의 구 이름 (서울 서초 → 서초구) */
  const mlRegionOpts = d.regions.map((r) => { const last = r.split(' ').pop()!; return /[구군시]$/.test(last) ? last : last + '구'; });
  const mlPages = (ML_SCOPE[ml.scope] ?? 0) * ml.regions.filter((r) => mlRegionOpts.includes(r)).length;
  const mlTotal = mlPages * langsOn.reduce((a, l) => a + (ml.countries[l]?.length ?? 1), 0);
  const multiCountry = langsOn.some((l) => (ml.countries[l]?.length ?? 1) > 1);
  const def = d.plan.defaultFeatures as Features;
  const diffs = FEATURES.filter(({ key }) => shown(key, f[key]) !== shown(key, def[key])).map(({ key, label }) => ({ label, from: shown(key, def[key]), to: shown(key, f[key]) }));
  const tier = TIERS.find((x) => x.name === d.partner.scope)!;

  const Switch = ({ k }: { k: 'alim' | 'place' | 'ml' | 'sheet' }) => (
    <form action={setFeature}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="key" value={k} /><input type="hidden" name="value" value={f[k] ? 'off' : 'on'} />
      <button className="sw" role="switch" aria-checked={f[k]} aria-label={FEATURES.find((x) => x.key === k)!.label} disabled={!can} />
    </form>
  );
  const Row = ({ k, children }: { k: string; children: React.ReactNode }) => {
    const def = FEATURES.find((x) => x.key === k)!;
    return (
      <div className="feat">
        <div className="feat__txt"><span className="feat__label">{def.label}</span><span className="feat__sub">{def.sub}</span></div>
        {children}
      </div>
    );
  };
  const MlButton = ({ op, v, lang, on, small, children }: { op: string; v: string; lang?: string; on: boolean; small?: boolean; children: React.ReactNode }) => (
    <form action={setMl}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="op" value={op} /><input type="hidden" name="v" value={v} />
      {lang && <input type="hidden" name="lang" value={lang} />}
      <button className={'sel' + (small ? ' sel--sm' : '')} aria-pressed={on} disabled={!can}>{children}</button>
    </form>
  );

  return (
    <div className="grid grid--15-1">
      <section className="card" style={{ padding: '8px 24px 16px' }} aria-label="기능 스위치">
        <Row k="alim"><Switch k="alim" /></Row>
        <Row k="blog">
          <form action={setFeature} className="seg seg--w320">
            <input type="hidden" name="id" value={id} /><input type="hidden" name="key" value="blog" />
            {BLOG_MODES.map((m) => <button key={m} name="value" value={m} className="seg__opt seg__opt--sm" aria-pressed={f.blog === m} disabled={!can}>{m}</button>)}
          </form>
        </Row>
        <Row k="place"><Switch k="place" /></Row>
        <Row k="ml"><Switch k="ml" /></Row>
        {f.ml && (
          <div className="mlbox">
            <div className="fld">
              <span className="fld__label">언어</span>
              <div className="tags">{LANGS.map((l) => <MlButton key={l} op="lang" v={l} on={ml.langs.includes(l)}>{l}</MlButton>)}</div>
            </div>
            <div className="fld">
              <span className="fld__label">언어별 대상 국가</span>
              {langsOn.map((l) => (
                <div key={l} className="mlrow">
                  <span className="mlrow__k">{l}</span>
                  <div className="tags" style={{ gap: 6 }}>
                    {[DOMESTIC, ...COUNTRIES[l]].map((c) => (
                      <MlButton key={c} op="country" lang={l} v={c} small on={(ml.countries[l] ?? [DOMESTIC]).includes(c)}>
                        {c === DOMESTIC ? '국내 거주 외국인(국가 지정 없음)' : c}
                      </MlButton>
                    ))}
                  </div>
                </div>
              ))}
              {multiCountry && <div className="warnbox"><span className="warnbox__i">!</span>나라별 내용이 실제로 다를 때만 나누세요. 같은 내용이면 중복 페이지가 돼요</div>}
            </div>
            <div className="fld">
              <span className="fld__label">번역할 지역</span>
              <div className="tags">{mlRegionOpts.map((r) => <MlButton key={r} op="region" v={r} on={ml.regions.includes(r)}>{r}</MlButton>)}</div>
            </div>
            <div className="fld">
              <span className="fld__label">번역 범위</span>
              <form action={setMl} className="seg">
                <input type="hidden" name="id" value={id} /><input type="hidden" name="op" value="scope" />
                {Object.keys(ML_SCOPE).map((s) => <button key={s} name="v" value={s} className="seg__opt seg__opt--sm" aria-pressed={ml.scope === s} disabled={!can}>{s}</button>)}
              </form>
              <span className="hint">번역 대상 {mlPages}페이지 · 언어 {langsOn.length}개 → 생성 {mlTotal}페이지 · 검수 후 공개</span>
            </div>
          </div>
        )}
        <Row k="sheet"><Switch k="sheet" /></Row>
      </section>

      <div className="stack">
        <section className="card card--pad">
          <div className="panel__head"><h3 className="panel__title">양산 범위</h3></div>
          <div className="row" style={{ alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24, fontWeight: 800 }}>{tier.name}</span>
            <span className={`chip chip--${tier.risk[1]}`}>{tier.risk[0]}</span>
          </div>
          <span className="hint" style={{ fontSize: 14 }}>예상 {tier.pages}페이지 · {tier.types.join(' · ')}</span>
          <Link href={`/admin/partners/${id}/scope`} className="btn-ghost btn-ghost--block" style={{ borderRadius: 12, fontWeight: 800 }}>범위 선택 ›</Link>
        </section>
        <section className="card card--pad" style={{ gap: 8 }}>
          <div className="panel__head"><h3 className="panel__title">요금제 기본값과 다른 항목</h3></div>
          <span className="hint" style={{ fontSize: 14 }}>{d.plan.name} 기본값에서 바뀐 스위치예요</span>
          {diffs.map((x) => (
            <div key={x.label} className="diff"><span className="diff__k">{x.label}</span><span className="hint">{x.from} →</span><span style={{ fontSize: 14, fontWeight: 800 }}>{x.to}</span></div>
          ))}
          {!diffs.length && <span className="ok-line">기본값 그대로예요</span>}
        </section>
      </div>
    </div>
  );
}
