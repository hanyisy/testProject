# 랜딩 데이터 (JSON)

랜딩 · 업체 공개 사이트가 읽는 값의 모양입니다. 파일이 아니라 Next 앱이 DB에서 만들어 내려 줍니다
(`/data/captures.json` · `/data/landing-values.json` · `/data/occupancy.json` · `/data/partner-sites.json` → `web/app/data/`).
값은 **어드민 › 설정 › 랜딩 관리**와 파트너 정보에서 고칩니다.
값이 없으면 `null` 또는 `""`로 두세요. 랜딩에서는 그 칸이 빈칸 + "실제 값 입력" 표시로 나옵니다.

## landing-values.json — 랜딩의 "실제 값 입력" 자리

| 항목 | 형식 | 랜딩에서 들어가는 곳 |
|---|---|---|
| `industries` | 숫자 | 숫자 띠 · 운영 업종 `○개` |
| `pages` | 숫자 | 숫자 띠 · 제작한 페이지 `○건` |
| `monthlyPages` | 숫자 | 약속 · `매달 페이지 ○장 이상 발행` |
| `fixDays` | 숫자 (영업일) | 약속 · `요청 후 ○영업일 안에 반영` |
| `indexDays` | 숫자 (일) | 실측 결과 · 색인까지 걸린 기간 `○일` |
| `business.ceo` | 글자 | 푸터 · 대표자 |
| `business.bizNo` | 글자 | 푸터 · 사업자등록번호 (예: `000-00-00000`) |
| `business.address` | 글자 | 푸터 · 주소 |
| `business.email` | 글자 | 푸터 · 이메일 |
| `business.phone` | 글자 | 푸터 · 전화, 모바일 "전화 상담" 버튼 (`config.js`의 `phone`이 비었을 때) |

## captures.json — "실제 검색 화면" 섹션

`items`가 비어 있거나 `visible: true`인 항목이 없으면 섹션 전체가 숨겨집니다.

| 항목 | 형식 | 설명 |
|---|---|---|
| `id` | 글자 | 겹치지 않는 값 (예: `cap-20261001-1`) |
| `image` | 주소 | 캡처 이미지 주소 (`/media/landing/…` · 랜딩 관리에서 올린 파일) |
| `query` | 글자 | 검색어 (예: `춘천 상가철거`) |
| `industry` | 글자 | `철거` · `입주청소` · `인테리어` · `바닥 시공` · `기타` 중 하나 (첫 화면 업종 칩과 같은 업종이 앞에 옵니다) |
| `partner` | 글자 | 파트너 상호 (랜딩에는 안 보이고, 관리용) |
| `capturedAt` | 날짜 | 캡처한 날 `YYYY-MM-DD` |
| `visible` | 참/거짓 | `false`면 랜딩에 안 나옵니다 |
| `order` | 숫자 | 작은 수가 앞. 같은 업종끼리의 순서도 이 값을 따릅니다 |

- **실제 검색 결과를 캡처한 이미지만** 넣습니다. 예시나 합성 이미지는 넣지 않습니다.
- 다른 업체 상호가 보이는 부분은 랜딩 관리에서 끌어서 표시하면 **이미지 파일 자체에 흐림을 입혀서** 올라갑니다. 랜딩은 이미지를 그대로 보여 줍니다.

```json
{
  "items": [
    { "id": "cap-20261001-1", "image": "captures/20261001-chuncheon.jpg", "query": "춘천 상가철거",
      "industry": "철거", "partner": "한결철거", "capturedAt": "2026-10-01", "visible": true, "order": 1 }
  ]
}
```

## partner-sites.json — 업체 공개 사이트의 문의 접수 완료 화면 (`/p/{slug}/contact/done`)

지금은 시안(`design/한결철거 공개 사이트.dc.html`)에 있는 두 업체만 들어 있어요. 업체 사이트가 서버로 만들어지면 서버가 같은 값을 채워 내려 주면 됩니다.

| 항목 | 형식 | 설명 |
|---|---|---|
| `slug` | 글자 | 주소 `/p/{slug}/` 의 업체 구분 값 |
| `name` · `mark` | 글자 | 업체명, 로고 자리 한 글자 |
| `brand` | 색 | 대표 색 (`--brand`) |
| `area` | 글자 | 서비스 지역 (데스크톱 머리에 보임) |
| `phone` | 글자 | 전화하기 버튼, 바닥 |
| `business.ceo` · `bizNo` · `address` | 글자 | 바닥 사업자 정보. 비우면 그 줄을 숨깁니다 |
