/* 구글 드라이브 어댑터 — 업체 사진 폴더 연결 · 동기화
 * 컨펌 단계: Drive API를 부르지 않고 폴더 주소 형식만 확인, 동기화는 시각만 (새로 가져온 사진 0장)
 * 운영: 같은 함수에서 Drive API로 폴더 권한 확인 · 새 파일을 내려받아 savePhoto로 넣음 */
import 'server-only';

export type DriveResult = { ok: true; imported: number } | { ok: false; error: string };

const FOLDER = /^https:\/\/drive\.google\.com\/drive\/(u\/\d+\/)?folders\/[A-Za-z0-9_-]{10,}/;

export function checkFolderUrl(url: string) {
  return FOLDER.test(url.trim());
}

export async function connectFolder(url: string): Promise<DriveResult> {
  if (!checkFolderUrl(url)) return { ok: false, error: '구글 드라이브 폴더 주소를 붙여 넣어 주세요 (drive.google.com/drive/folders/…)' };
  await new Promise((r) => setTimeout(r, 600));
  return { ok: true, imported: 0 };
}

export async function syncFolder(url: string | null): Promise<DriveResult> {
  if (!url) return { ok: false, error: '연결된 폴더가 없어요' };
  await new Promise((r) => setTimeout(r, 900));
  return { ok: true, imported: 0 };
}
