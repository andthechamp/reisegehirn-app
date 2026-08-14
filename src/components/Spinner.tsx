export default function Spinner({ label = "Lädt …" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 text-ink/60">
      <svg className="h-4 w-4 animate-spin text-fjord" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-90" d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span>{label}</span>
    </div>
  );
}
