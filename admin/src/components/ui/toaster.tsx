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
          onOpenChange={(open) => {
            if (!open) dismiss(item.id);
          }}
          className={cn(
            "fixed bottom-4 right-4 z-50 w-80 rounded-md border bg-white p-4 shadow-sm",
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
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport />
    </ToastPrimitive.Provider>
  );
}
