/* 파트너 상단 줄 공통 버튼 (시안 2a · 2c · 2j): 사진 추가 · 새 사진 검토(대기 수) */
import Link from 'next/link';

export default function PhotoActions({ newPhotos }: { newPhotos: number }) {
  return (
    <>
      <Link href="/partner/photos" className="pbtn pbtn--line">사진 추가</Link>
      <Link href="/partner/sites" className="pbtn pbtn--accent">새 사진 검토{newPhotos > 0 && <span className="pbtn__n">{newPhotos}</span>}</Link>
    </>
  );
}
