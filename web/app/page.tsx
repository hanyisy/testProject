import { redirect } from 'next/navigation';

/* 랜딩을 이 앱으로 옮기기 전까지는 로그인 화면으로 */
export default function Home() {
  redirect('/login');
}
