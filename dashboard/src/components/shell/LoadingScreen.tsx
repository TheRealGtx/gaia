import type { Ref } from "react";

export function LoadingScreen({ label = "Loading Gaia…", ref }: { label?: string; ref?: Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} className="loading-screen" role="status" aria-live="polite" aria-atomic="true">
      <div className="loading-screen__content">
        <span className="loading-screen__logo" aria-hidden="true" />
        <span className="loading-screen__brand" aria-hidden="true">gaia</span>
        <span className="loading-screen__label">{label}</span>
      </div>
    </div>
  );
}
