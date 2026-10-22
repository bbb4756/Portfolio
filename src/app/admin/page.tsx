import { AdminStudio } from "@/components/AdminStudio";
import { getAdminSession } from "@/lib/session";
import Link from "next/link";

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session) return <main className="admin-login"><div><p className="admin-kicker">Portfolio Studio</p><h1>Content lives<br />in Git.</h1><p>GitHub 계정과 저장소 쓰기 권한을 모두 확인한 뒤 관리자 화면을 엽니다.</p><a className="admin-primary" href="/api/auth/github/start">Continue with GitHub</a><Link className="admin-secondary" href="/">Return to portfolio</Link></div></main>;
  return <AdminStudio login={session.login} preview={Boolean(session.preview)} />;
}
