import Link from "next/link";

export default function NotFound() {
  return <main className="not-found"><p className="eyebrow">404 / Not Found</p><h1>This page is<br />not in the index.</h1><Link href="/">Return home ↗</Link></main>;
}

