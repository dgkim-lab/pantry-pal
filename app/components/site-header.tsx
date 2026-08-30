import Link from "next/link";

export function SiteHeader({ name }: { name?: string | null }) {
  return (
    <header className="topbar">
      <Link href="/lists" className="wordmark">
        <span className="brand-mark small">PP</span>
        pantry pal
      </Link>
      <nav className="topbar-links" aria-label="Primary navigation">
        <Link href="/lists">Lists</Link>
        <Link href="/catalog">Catalog</Link>
        <Link href="/stores">Stores</Link>
        <Link href="/history">History</Link>
        <div className="user-chip">{name?.slice(0, 1) ?? "U"}</div>
      </nav>
    </header>
  );
}
