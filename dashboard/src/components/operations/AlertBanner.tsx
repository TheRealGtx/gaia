"use client";

import { AlertTriangle, CheckCircle2, RadioTower } from "lucide-react";
import type { EnvironmentState } from "../../domain/types";
import { deriveAlertBanner } from "./alertBannerModel";

export function AlertBanner({ environment }: { environment: EnvironmentState }) {
  const banner = deriveAlertBanner(environment);
  const Icon = banner.status === "critical" ? AlertTriangle : banner.status === "normal" ? CheckCircle2 : RadioTower;
  return <section className={`alert-banner alert-banner--${banner.status}`} role="status" aria-live="polite"><Icon size={17} /><strong>{banner.label}</strong><span>{banner.detail}</span></section>;
}
