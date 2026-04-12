type Variant = "info" | "success" | "warning" | "error" | "purple";

const variants: Record<Variant, string> = {
  info: "bg-blue-100 text-blue-800",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  error: "bg-red-100 text-red-800",
  purple: "bg-indigo-100 text-indigo-800",
};

type Props = {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  dot?: boolean;
};

export function Badge({ children, variant = "info", className = "", dot }: Props) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
