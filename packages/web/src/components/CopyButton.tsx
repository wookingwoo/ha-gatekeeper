import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { Button, type ButtonProps } from "./ui/button";

export function CopyButton({
  value,
  label,
  variant = "default",
}: {
  value: string;
  label: string;
  variant?: ButtonProps["variant"];
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const generation = useRef(0);
  useEffect(() => {
    generation.current += 1;
    setStatus("idle");
    return () => {
      generation.current += 1;
      clearTimeout(timer.current);
    };
  }, [value]);
  async function copy() {
    const requestGeneration = ++generation.current;
    let nextStatus: "copied" | "error";
    try {
      await navigator.clipboard.writeText(value);
      nextStatus = "copied";
    } catch {
      nextStatus = "error";
    }
    if (requestGeneration !== generation.current) return;
    setStatus(nextStatus);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), 4000);
  }
  return (
    <div className="inline-flex flex-col gap-1">
      <Button variant={variant} onClick={copy}>
        <Icon name={status === "copied" ? "check" : "copy"} size={16} />
        {status === "copied" ? "Copied!" : label}
      </Button>
      <span role="status" className="text-xs text-[var(--muted)]">
        {status === "error"
          ? "Copy unavailable. Select and copy the text above."
          : status === "copied"
            ? "Copied to clipboard."
            : ""}
      </span>
    </div>
  );
}
