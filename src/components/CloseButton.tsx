"use client";

import { useRouter } from "next/navigation";

export default function CloseButton({ fallbackHref = "/" }: { fallbackHref?: string }) {
  const router = useRouter();

  const handleClick = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Schließen"
      className="flex h-8 w-8 items-center justify-center rounded-full text-ink/40 hover:bg-ink/5 hover:text-ink"
    >
      ✕
    </button>
  );
}
