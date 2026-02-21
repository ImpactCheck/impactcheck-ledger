import { Shield, ShieldCheck, ShieldAlert } from "lucide-react";

interface ComplianceBadgeProps {
  level: "green" | "yellow" | "red";
}

const config = {
  green: {
    icon: ShieldCheck,
    label: "Compliant",
    className: "bg-primary/10 text-primary border-primary/30",
  },
  yellow: {
    icon: Shield,
    label: "Conditional",
    className: "bg-warning/10 text-warning border-warning/30",
  },
  red: {
    icon: ShieldAlert,
    label: "Non-Compliant",
    className: "bg-destructive/10 text-destructive border-destructive/30",
  },
};

export function ComplianceBadge({ level }: ComplianceBadgeProps) {
  const { icon: Icon, label, className } = config[level];
  return (
    <div className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium ${className}`}>
      <Icon className="h-4 w-4" />
      <span>Sovereign AI Compliance: {label}</span>
    </div>
  );
}
