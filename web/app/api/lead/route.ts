/* 랜딩 가입 문의 폼 (첫 화면 · 아래 전체 폼 · 대기 신청) → 가입 문의(leads)에 저장 → 303 /landing/done.html
 * 폼은 그냥 POST(자바스크립트 없어도 동작). 본사 어드민 "가입 문의"에 신규로 뜸 */
import { getDb, schema as t } from '@/db/client';

const str = (v: FormDataEntryValue | null, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function POST(req: Request) {
  let fd: FormData;
  try { fd = await req.formData(); } catch { return new Response('bad request', { status: 400 }); }
  /* 봇이 채우는 숨은 칸이 있으면 조용히 끝냄 */
  if (str(fd.get('website'))) return Response.redirect(new URL('/landing/done.html', req.url), 303);
  const company = str(fd.get('company')), phone = str(fd.get('phone'), 40);
  if (!company || !/^[0-9+\-\s()]{8,20}$/.test(phone) || str(fd.get('agree')) !== 'y') {
    return Response.redirect(new URL('/landing/?error=form#form-full', req.url), 303);
  }
  const region = str(fd.get('region'), 60);
  const db = await getDb();
  await db.insert(t.leads).values({
    company, phone, manager: str(fd.get('name'), 60) || null, email: str(fd.get('email'), 120) || null,
    homepage: str(fd.get('homepage'), 200) || null, message: str(fd.get('message'), 2000) || null,
    industry: str(fd.get('industry'), 40) || '기타', regions: region ? region.split(/[,·]/).map((r) => r.trim()).filter(Boolean) : [],
    requestType: str(fd.get('request_type')) === 'waitlist' ? 'waitlist' : 'new', sourceForm: str(fd.get('form_id'), 20) || null
  });
  return Response.redirect(new URL('/landing/done.html', req.url), 303);
}
