import { clsx } from "clsx";

const colors: Record<string, string> = {
  A1: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  A2: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  B1: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  B2: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  C1: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  C2: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export function LevelBadge({ level, size = "sm" }: { level: string; size?: "sm" | "md" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center font-semibold rounded",
        colors[level] ?? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
      )}
    >
      {level}
    </span>
  );
}
