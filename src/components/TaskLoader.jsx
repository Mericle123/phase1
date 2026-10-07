import { cn } from "../lib/utils";

const loaderConfig = {
  interaction: {
    title: "Applying action",
    detail: "Keeping your workspace up to date...",
    steps: ["Start", "Process", "Ready"],
  },
  workspace: {
    title: "Opening NZ Britannia",
    detail: "Preparing your financial workspace...",
    steps: ["Identity", "Records", "Trace"],
  },
  login: {
    title: "Unlocking your workspace",
    detail: "Checking access and opening your secure session...",
    steps: ["Account", "Role", "Session"],
  },
  invoice: {
    title: "Recording invoice",
    detail: "Writing the entry and checking its financial trail...",
    steps: ["Details", "Amounts", "Ledger"],
  },
  verify: {
    title: "Verifying record",
    detail: "Checking the record against its supporting details...",
    steps: ["Review", "Confirm", "Trace"],
  },
  activity: {
    title: "Loading activity",
    detail: "Reading employee action trails...",
    steps: ["Actions", "Office", "Risk"],
  },
  timing: {
    title: "Checking timing",
    detail: "Calculating arrival window and deductions...",
    steps: ["Check-in", "Late", "Deduct"],
  },
  payment: {
    title: "Checking payments",
    detail: "Separating paid, pending, and unpaid records...",
    steps: ["Invoice", "Received", "Balance"],
  },
  report: {
    title: "Building report",
    detail: "Turning financial activity into a clear picture...",
    steps: ["Collect", "Calculate", "Present"],
  },
  message: {
    title: "Sending message",
    detail: "Delivering the update to the right person...",
    steps: ["Compose", "Route", "Deliver"],
  },
  user: {
    title: "Updating access",
    detail: "Applying the account and permission changes...",
    steps: ["Account", "Role", "Access"],
  },
  profile: {
    title: "Securing profile",
    detail: "Saving your account preferences securely...",
    steps: ["Check", "Protect", "Save"],
  },
  record: {
    title: "Loading record",
    detail: "Preparing the invoice record...",
    steps: ["Entry", "Verify", "History"],
  },
};

export function TaskLoader({ type = "workspace", compact = false, className }) {
  const config = loaderConfig[type] || loaderConfig.workspace;
  return (
    <div className={cn("task-loader", compact && "task-loader-compact", className)} role="status" aria-live="polite">
      <div className={cn("typewriter-stage", `typewriter-stage-${type}`)} aria-hidden="true">
        <div className="typewriter-scale">
          <div className="typewriter">
            <div className="slide"><i /></div>
            <div className="paper" />
            <div className="keyboard" />
          </div>
        </div>
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
