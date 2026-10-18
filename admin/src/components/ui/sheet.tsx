import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetPortal = DialogPrimitive.Portal;
export const SheetClose = DialogPrimitive.Close;

export const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-modal-backdrop bg-zinc-950/50 backdrop-blur-[2px] animate-overlay-in",
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-y-0 right-0 z-modal flex w-full max-w-lg flex-col border-l border-zinc-200 bg-white shadow-overlay animate-sheet-in",
        className,
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = DialogPrimitive.Content.displayName;

export const SheetHeader = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex items-start justify-between gap-2 border-b border-zinc-200 p-6 pb-4",
      className,
    )}
    {...props}
  >
    <div className="flex flex-col gap-1">{children}</div>
    <DialogPrimitive.Close className="rounded-md p-1 text-subtle opacity-70 transition-colors hover:bg-zinc-100 hover:text-zinc-900 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-1">
      <X className="h-4 w-4" />
      <span className="sr-only">Fermer</span>
    </DialogPrimitive.Close>
  </div>
);

export const SheetBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  // min-h-0 est nécessaire : sans lui, un enfant flex-1 ne se contraint pas à la hauteur du
  // parent (fixed inset-y-0) et déborde au lieu de défiler — header et footer ne restent plus figés.
  <div className={cn("min-h-0 flex-1 overflow-y-auto p-6", className)} {...props} />
);

export const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex shrink-0 items-center gap-2 border-t border-zinc-200 p-4", className)}
    {...props}
  />
);

export const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-base font-semibold text-zinc-900", className)}
    {...props}
  />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;

export const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-zinc-500", className)}
    {...props}
  />
));
SheetDescription.displayName = DialogPrimitive.Description.displayName;
