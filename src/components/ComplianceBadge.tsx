import { Shield, ShieldCheck, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComplianceBadgeProps {
  level: "green" | "yellow" | "red";
  className?: string;
  /** Use when badge is on a dark background (e.g. hero card) */
  onDark?: boolean;
}

const config = {
  green: {
    icon: ShieldCheck,
    label: "Compliant",
    className:
      "bg-green-100 text-green-800 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30",
    onDarkClassName: "bg-white/15 text-white border-white/30",
  },
  yellow: {
    icon: Shield,
    label: "Conditional",
    className:
      "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30",
    onDarkClassName: "bg-amber-400/20 text-amber-200 border-amber-400/40",
  },
  red: {
    icon: ShieldAlert,
    label: "Non-Compliant",
    className:
      "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30",
    onDarkClassName: "bg-red-400/20 text-red-200 border-red-400/40",
  },
};

export function ComplianceBadge({ level, className, onDark }: ComplianceBadgeProps) {
  const { icon: Icon, label, className: levelClass, onDarkClassName } = config[level];
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium",
        onDark ? onDarkClassName : levelClass,
        className
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>Sovereign AI Compliance: {label}</span>
    </div>
  );
}
