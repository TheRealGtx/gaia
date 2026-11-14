"use client";

import { useEffect, useRef } from "react";
import { LoadingScreen } from "./LoadingScreen";

export function FullScreenLoader({ label }: { label?: string }) {
  const screenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".app-shell");
    // The loader stays beside the app content so its CSS animation never remounts.
    const controls = Array.from(shell?.children ?? [])
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== screenRef.current)
      .map((element) => ({ element, inert: element.inert }));
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    for (const { element } of controls) element.inert = true;
    document.body.style.overflow = "hidden";

    return () => {
      for (const { element, inert } of controls) element.inert = inert;
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected && document.activeElement === document.body) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  return <LoadingScreen ref={screenRef} label={label} />;
}
