import * as ToastPrimitive from "@radix-ui/react-toast";
import { cn } from "../../lib/utils";
import { useToast } from "../../hooks/use-toast";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {toasts.map((item) => (
        <ToastPrimitive.Root
          key={item.id}
          open
          duration={item.duration ?? 4000}
          onOpenChange={(open) => {
            if (!open) dismiss(item.id);
          }}
          className={cn(
            "fixed bottom-4 right-4 z-toast w-80 rounded-md border bg-white p-4 shadow-sm",
            item.variant === "destructive" && "border-red-300 bg-red-50",
          )}
        >
          {item.title && (
            <ToastPrimitive.Title className="text-sm font-medium text-zinc-900">
              {item.title}
            </ToastPrimitive.Title>
          )}
          {item.description && (
            <ToastPrimitive.Description className="mt-1 text-sm text-zinc-600">
              {item.description}
            </ToastPrimitive.Description>
          )}
          {item.action && (
            <ToastPrimitive.Action altText={item.action.label} asChild>
              <button
                type="button"
                onClick={() => {
                  item.action?.onClick();
                  dismiss(item.id);
                }}
                className="alterra-focus mt-2 min-h-8 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              >
                {item.action.label}
              </button>
            </ToastPrimitive.Action>
          )}
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport />
    </ToastPrimitive.Provider>
  );
}
