import { useEffect, useRef } from "react";
import { HomeAssistantTokenHelp } from "./HomeAssistantTokenHelp";
import { Icon } from "./Icon";
import { Button } from "./ui/button";

export function HomeAssistantHelpDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-label="Connect Home Assistant"
      className="max-h-[90dvh] w-[calc(100%_-_32px)] max-w-xl overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--foreground)] shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
        <h2 className="text-sm font-semibold">Connect Home Assistant</h2>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
          <Icon name="close" size={16} />
        </Button>
      </div>
      <div className="p-4">
        <HomeAssistantTokenHelp />
      </div>
    </dialog>
  );
}
