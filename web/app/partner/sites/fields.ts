/* 업종 템플릿 "현장 입력 항목" → 입력 칸 종류 (발행 화면 · 서버 검사 공용)
 * area: 평수 숫자 · days: 기간 일수 · note: 특이사항 한 줄 · choice: 위의 작업/유형 선택으로 받음 · extra: 그 밖의 짧은 글 */
export type FieldKind = 'area' | 'days' | 'note' | 'choice' | 'extra';

export function fieldKind(label: string): FieldKind {
  if (/^(평수|시공 면적|면적)$/.test(label)) return 'area';
  if (/^(작업 기간|기간|공사 기간|진행 기간)$/.test(label)) return 'days';
  if (/^특이사항/.test(label)) return 'note';
  if (/^(작업 종류|건물 유형|대상 유형)$/.test(label)) return 'choice';
  return 'extra';
}
