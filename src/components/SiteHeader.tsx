import Link from "next/link";

export function SiteHeader() {
  return (
    <><a className="skip-link" href="#main">본문으로 건너뛰기</a><header className="site-header">
      <Link href="/" className="wordmark" aria-label="Gyuri Kim home">GK</Link>
      <nav aria-label="Primary navigation">
        <Link href="/projects">Projects</Link>
        <Link href="/engineering">Engineering</Link>
        <Link href="/#experience">Experience</Link>
        <Link href="/#contact">Contact</Link>
      </nav>
    </header></>
  );
}
