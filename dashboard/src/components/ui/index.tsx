import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { SensorStatus } from "../../domain/types";

export function Button({
  icon: Icon,
  variant = "outline",
  iconOnly = false,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: LucideIcon;
  variant?: "outline" | "dark" | "ghost" | "danger" | "active";
  iconOnly?: boolean;
}) {
  return (
    <button className={`button button--${variant} ${iconOnly ? "button--icon" : ""} ${className}`} {...props}>
      {Icon ? <Icon size={15} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function Card({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`} {...props}>{children}</div>;
}

export function StatusDot({ status }: { status: SensorStatus }) {
  return <span className={`status-dot tone-${status}`} aria-hidden="true" />;
}

export function StatusBadge({ status, children, dot = true, className = "" }: {
  status: SensorStatus;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return <span className={`badge tone-${status} ${className}`}>{dot ? <StatusDot status={status} /> : null}{children}</span>;
}

export function SegmentedControl<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; icon?: LucideIcon }>;
  onChange(value: T): void;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <Button key={option.value} variant="ghost" icon={option.icon} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
          {option.label}
        </Button>
      ))}
    </div>
  );
}

export function MetricCard({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return <Card className="metric-card"><div className="metric-card__label">{label}</div><div className="metric-card__value"><strong>{value}</strong>{detail ? <span className="metric-card__detail">{detail}</span> : null}</div></Card>;
}
