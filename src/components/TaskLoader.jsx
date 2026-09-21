import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock3,
  CreditCard,
  FilePenLine,
  KeyRound,
  Send,
  ShieldCheck,
  UnlockKeyhole,
  UsersRound,
} from "lucide-react";
import { cn } from "../lib/utils";

const loaderConfig = {
  workspace: {
    icon: ShieldCheck,
    title: "Opening NZ Britannia",
    detail: "Preparing your financial workspace...",
    steps: ["Identity", "Records", "Trace"],
  },
  login: {
    icon: UnlockKeyhole,
    title: "Unlocking your workspace",
    detail: "Checking access and opening your secure session...",
    steps: ["Account", "Role", "Session"],
  },
  invoice: {
    icon: FilePenLine,
    title: "Recording invoice",
    detail: "Writing the entry and checking its financial trail...",
    steps: ["Details", "Amounts", "Ledger"],
  },
  verify: {
    icon: ShieldCheck,
    title: "Verifying record",
    detail: "Checking the record against its supporting details...",
    steps: ["Review", "Confirm", "Trace"],
  },
  activity: {
    icon: Activity,
    title: "Loading activity",
    detail: "Reading employee action trails...",
    steps: ["Actions", "Office", "Risk"],
  },
  timing: {
    icon: Clock3,
    title: "Checking timing",
    detail: "Calculating arrival window and deductions...",
    steps: ["Check-in", "Late", "Deduct"],
  },
  payment: {
    icon: CreditCard,
    title: "Checking payments",
    detail: "Separating paid, pending, and unpaid records...",
    steps: ["Invoice", "Received", "Balance"],
  },
  report: {
    icon: BarChart3,
    title: "Building report",
    detail: "Turning financial activity into a clear picture...",
    steps: ["Collect", "Calculate", "Present"],
  },
  message: {
    icon: Send,
    title: "Sending message",
    detail: "Delivering the update to the right person...",
    steps: ["Compose", "Route", "Deliver"],
  },
  user: {
    icon: UsersRound,
    title: "Updating access",
    detail: "Applying the account and permission changes...",
    steps: ["Account", "Role", "Access"],
  },
  profile: {
    icon: KeyRound,
    title: "Securing profile",
    detail: "Saving your account preferences securely...",
    steps: ["Check", "Protect", "Save"],
  },
  record: {
    icon: CheckCircle2,
    title: "Loading record",
    detail: "Preparing the invoice record...",
    steps: ["Entry", "Verify", "History"],
  },
};

export function TaskLoader({ type = "workspace", compact = false, className }) {
  const config = loaderConfig[type] || loaderConfig.workspace;
  const Icon = config.icon;
  return (
    <div className={cn("task-loader", compact && "task-loader-compact", className)} role="status" aria-live="polite">
      <div className={cn("task-loader-visual", `task-loader-visual-${type}`)} aria-hidden="true">
        <Icon size={compact ? 17 : 23} strokeWidth={2.1} />
        <span className="task-loader-orbit" />
        <span className="task-loader-spark task-loader-spark-one" />
        <span className="task-loader-spark task-loader-spark-two" />
      </div>
      <div className="min-w-0">
        <p className="task-loader-title">{config.title}</p>
        <p className="task-loader-detail">{config.detail}</p>
        <div className="task-loader-steps" aria-hidden="true">
          {config.steps.map((step, index) => (
            <span key={step} style={{ "--step": index }}>
              {step}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
