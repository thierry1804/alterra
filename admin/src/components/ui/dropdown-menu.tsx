import * as React from "react";
import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "../../lib/utils";

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.Content>
>(({ className, sideOffset = 4, align = "end", ...props }, ref) => (
  <MenuPrimitive.Portal>
    <MenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      align={align}
      className={cn(
        "z-popover min-w-44 rounded-lg border border-zinc-200 bg-white p-1 text-sm shadow-overlay",
        className,
      )}
      {...props}
    />
  </MenuPrimitive.Portal>
));
DropdownMenuContent.displayName = MenuPrimitive.Content.displayName;

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.Item> & { destructive?: boolean }
>(({ className, destructive, ...props }, ref) => (
  <MenuPrimitive.Item
    ref={ref}
    className={cn(
      "flex min-h-8 cursor-default select-none items-center gap-2 rounded-md px-2.5 py-1.5 outline-none",
      "data-[highlighted]:bg-zinc-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      destructive && "text-danger data-[highlighted]:bg-danger-bg",
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = MenuPrimitive.Item.displayName;

export const DropdownMenuSeparator = () => (
  <MenuPrimitive.Separator className="my-1 h-px bg-zinc-200" />
);
