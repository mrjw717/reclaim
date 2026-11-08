import iconSource from "./assets/reclaim-icon.svg?raw";
import wordmarkSource from "./assets/wordmark.svg?raw";

/**
 * Combined brand lockup: the reclaim icon (rounded mark + arrow "R" + pin)
 * beside the wordmark. The mark's fill is currentColor, so the wrapper's
 * color decides the brand hue — set it to var(--brand-primary) and the
 * lockup re-themes with the organization color; amber accents and the white
 * arrow are fixed brand art. The wordmark text follows the text tokens.
 */
export function BrandLockup({ label = "Reclaim — Lost & Found Management" }: { label?: string }) {
  return (
    <span className="brand-lockup-svg" role="img" aria-label={label}>
      <span
        className="lockup-mark"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: iconSource }}
      />
      <span
        className="lockup-word"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: wordmarkSource }}
      />
    </span>
  );
}

/** Icon-only brand mark for compact surfaces (launch state). */
export function BrandIcon({
  label = "Reclaim",
  className = "brand-launch-icon",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={className}
      role="img"
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: iconSource }}
    />
  );
}
