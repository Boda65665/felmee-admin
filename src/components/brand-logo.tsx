import mark from "@/assets/felmee-mark.svg";
import wordmark from "@/assets/felmee-wordmark.png";
import { cn } from "@/lib/utils";

/** Original logo assets from the Felmee landing page in Figma. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <div role="img" aria-label="Felmee" className={cn("flex shrink-0 items-center gap-[13px]", className)}>
      <img src={mark} alt="" width={44} height={44} className="shrink-0" />
      <img src={wordmark} alt="" width={115} height={26.5} className="h-auto shrink-0" />
    </div>
  );
}
