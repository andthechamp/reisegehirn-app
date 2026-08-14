import { SpinnerIcon } from "@/components/icons";

export default function Spinner({ label = "Lädt …" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 text-ink/60">
      <SpinnerIcon className="h-4 w-4 text-fjord" />
      <span>{label}</span>
    </div>
  );
}
