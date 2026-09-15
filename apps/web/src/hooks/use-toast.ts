"use client";

// Minimal toast store — shadcn's standard pattern, trimmed to what this app
// actually uses (no toast queue limit tuning beyond a sane default).
import * as React from "react";
import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 3;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type State = { toasts: ToasterToast[] };
type Listener = (state: State) => void;

let memoryState: State = { toasts: [] };
const listeners: Listener[] = [];

function dispatch(newToasts: ToasterToast[]) {
  memoryState = { toasts: newToasts.slice(0, TOAST_LIMIT) };
  listeners.forEach((listener) => listener(memoryState));
}

export function toast(props: Omit<ToasterToast, "id">) {
  const id = genId();
  const dismiss = () => dispatch(memoryState.toasts.filter((t) => t.id !== id));
  dispatch([
    {
      ...props,
      id,
      open: true,
      onOpenChange: (open: boolean) => !open && dismiss(),
    },
    ...memoryState.toasts,
  ]);
  return { id, dismiss };
}

export function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) listeners.splice(index, 1);
    };
  }, []);

  return { ...state, toast };
}
