import * as React from "react";

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 4000;

export type ToastVariant = "default" | "destructive";

export interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

type ToastAction =
  | { type: "ADD"; toast: ToastItem }
  | { type: "DISMISS"; id: string }
  | { type: "REMOVE"; id: string };

interface ToastState {
  toasts: ToastItem[];
}

const listeners: Array<(state: ToastState) => void> = [];
let memoryState: ToastState = { toasts: [] };
const timeouts = new Map<string, ReturnType<typeof setTimeout>>();

function dispatch(action: ToastAction) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => listener(memoryState));
}

function reducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case "ADD":
      return { toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) };
    case "DISMISS":
      return {
        toasts: state.toasts.filter((toast) => toast.id !== action.id),
      };
    case "REMOVE":
      return {
        toasts: state.toasts.filter((toast) => toast.id !== action.id),
      };
    default:
      return state;
  }
}

export function toast(input: Omit<ToastItem, "id">) {
  const id = crypto.randomUUID();
  dispatch({ type: "ADD", toast: { ...input, id } });

  if (timeouts.has(id)) clearTimeout(timeouts.get(id));
  timeouts.set(
    id,
    setTimeout(() => {
      dispatch({ type: "REMOVE", id });
      timeouts.delete(id);
    }, TOAST_REMOVE_DELAY),
  );

  return { id, dismiss: () => dispatch({ type: "DISMISS", id }) };
}

export function useToast() {
  const [state, setState] = React.useState<ToastState>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index >= 0) listeners.splice(index, 1);
    };
  }, []);

  return {
    toasts: state.toasts,
    toast,
    dismiss: (id: string) => dispatch({ type: "DISMISS", id }),
  };
}
