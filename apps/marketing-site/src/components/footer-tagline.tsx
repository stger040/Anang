import type { ReactNode } from "react";

const BOLD_FRAGMENTS =
  /(patient financial engagement|claims intelligence|denial prevention)/gi;

/** Renders footer tagline with key phrases emphasized (matches brand shortDescription wording). */
export function FooterTagline({ text }: { text: string }) {
  const segments = text.split(BOLD_FRAGMENTS);
  const nodes: ReactNode[] = [];
  let key = 0;
  for (const segment of segments) {
    if (!segment) continue;
    const lower = segment.toLowerCase();
    if (
      lower === "patient financial engagement" ||
      lower === "claims intelligence" ||
      lower === "denial prevention"
    ) {
      nodes.push(
        <strong key={key} className="font-semibold text-white/85">
          {segment}
        </strong>,
      );
    } else {
      nodes.push(segment);
    }
    key += 1;
  }

  return (
    <p className="mt-4 max-w-md text-[1.3125rem] leading-snug text-white/70 sm:max-w-lg">
      {nodes}
    </p>
  );
}
