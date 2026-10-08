/* JPEG EXIF에서 촬영 시각 · GPS만 읽음 (외부 라이브러리 없음). 못 읽으면 빈 값 — 올리기는 그대로 진행 */
export type Exif = { takenAt?: Date; lat?: number; lng?: number };

export function readExif(buf: Buffer): Exif {
  try {
    if (buf.readUInt16BE(0) !== 0xffd8) return {};
    let o = 2;
    while (o + 4 < buf.length) {
      const marker = buf.readUInt16BE(o);
      const len = buf.readUInt16BE(o + 2);
      if (marker === 0xffe1 && buf.toString('latin1', o + 4, o + 10) === 'Exif\0\0') return parseTiff(buf, o + 10);
      if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) break;
      o += 2 + len;
    }
  } catch { /* 깨진 EXIF는 무시 */ }
  return {};
}

function parseTiff(b: Buffer, base: number): Exif {
  const le = b.toString('latin1', base, base + 2) === 'II';
  const u16 = (p: number) => (le ? b.readUInt16LE(p) : b.readUInt16BE(p));
  const u32 = (p: number) => (le ? b.readUInt32LE(p) : b.readUInt32BE(p));
  const ifd = (off: number) => {
    const tags = new Map<number, { type: number; count: number; at: number }>();
    const p = base + off;
    const n = u16(p);
    for (let i = 0; i < n; i++) {
      const e = p + 2 + i * 12;
      const type = u16(e + 2), count = u32(e + 4);
      const size = ({ 1: 1, 2: 1, 3: 2, 4: 4, 5: 8 } as Record<number, number>)[type] ?? 1;
      tags.set(u16(e), { type, count, at: size * count > 4 ? base + u32(e + 8) : e + 8 });
    }
    return tags;
  };
  const str = (t?: { count: number; at: number }) => (t ? b.toString('latin1', t.at, t.at + t.count).replace(/\0+$/, '') : undefined);
  const rats = (t?: { count: number; at: number }) => (t ? Array.from({ length: t.count }, (_, i) => u32(t.at + i * 8) / (u32(t.at + i * 8 + 4) || 1)) : undefined);

  const out: Exif = {};
  const ifd0 = ifd(u32(base + 4));
  const exifPtr = ifd0.get(0x8769);
  const sub = exifPtr ? ifd(u32(exifPtr.at)) : undefined;
  /* DateTimeOriginal "2026:09:30 14:05:11" — 한국 시간으로 봄 */
  const dt = str(sub?.get(0x9003)) ?? str(ifd0.get(0x0132));
  const m = dt?.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (m) out.takenAt = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+09:00`);
  const gpsPtr = ifd0.get(0x8825);
  if (gpsPtr) {
    const g = ifd(u32(gpsPtr.at));
    const dms = (v?: number[]) => (v && v.length === 3 ? v[0] + v[1] / 60 + v[2] / 3600 : undefined);
    const lat = dms(rats(g.get(2))), lng = dms(rats(g.get(4)));
    if (lat !== undefined && lng !== undefined && (lat || lng)) {
      out.lat = str(g.get(1)) === 'S' ? -lat : lat;
      out.lng = str(g.get(3)) === 'W' ? -lng : lng;
    }
  }
  return out;
}
