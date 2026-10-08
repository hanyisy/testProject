import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Contact, Hero, MapPins, Ph, Sec, SiteCards } from '@/components/site/Blocks';
import { fill, href, livePages, siteBySlug, sitesOf } from '@/lib/site';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const s = await siteBySlug((await params).slug);
  return { title: { absolute: s ? `${s.partner.name} · ${s.area} ${s.industry.name}` : '업체 사이트' } };
}

/* 시안 01 홈 — 머리 · 최근 현장 · 서비스 지역 · 대표 가이드 · 문의 */
export default async function SiteHome({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ err?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const s = await siteBySlug(slug);
  if (!s) notFound();
  const [sites, pages] = await Promise.all([sitesOf(s.partner.id, slug), livePages(s.partner.id)]);
  const cover = sites.flatMap((x) => x.photos).find((p) => p.shot === '후' && p.src) ?? sites[0]?.photos[0];
  const guidePage = pages.find((p) => p.type === '가이드');
  const guide = s.ic?.guides.find((g) => guidePage?.path === `가이드/${g.slug}`);
  const guidePhoto = sites[1]?.photos[1] ?? sites[0]?.photos[1];
  const v = s.vars({ 지역: s.cities.join('·') + ' ' });
  return (
    <>
      <Hero s={s} eyebrow={s.area} title={fill(s.content?.home.title ?? '{업체}', v)} lead={s.content?.home.lead} photo={cover} caption={cover ? `${cover.caption} · 대표 사진` : '대표 사진'} />
      <Sec title="최근 현장" sub="날짜, 평수, 작업 기간을 그대로 적었어요" id="cases">
        <SiteCards slug={slug} sites={sites.slice(0, 4)} cols={4} />
        {s.cities[0] && <Link href={href(slug, s.cities[0])} className="s-more">현장 기록 전체 보기 ›</Link>}
      </Sec>
      <Sec title="서비스 지역" sub={s.area} card>
        <MapPins label={`지도 · ${s.cities.join('·')}`} pins={Array.from(new Set(sites.map((x) => x.dong).filter(Boolean))).slice(0, 6)} />
      </Sec>
      {guide && guidePage?.path && (
        <Sec title="대표 가이드">
          <Link href={href(slug, guidePage.path)} className="s-guidecard">
            <Ph photo={guidePhoto} kind="wide" />
            <div><b>{guide.title}</b><span>{guide.short}</span><em>읽어 보기 ›</em></div>
          </Link>
        </Sec>
      )}
      <Sec><Contact s={s} from="" error={sp.err === '1'} /></Sec>
    </>
  );
}
