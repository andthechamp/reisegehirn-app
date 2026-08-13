import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="border-b border-ink/10 bg-mist/80 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center px-6 py-3">
        <Link href="/" className="text-sm font-semibold text-fjord-dark hover:text-fjord">
          ⛵ Reisegehirn
        </Link>
      </div>
    </header>
  );
}
