import { ViewTransition } from "react";

// Templates remount on navigation, so each route change plays an exit and an enter.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition
      enter={{ "nav-forward": "page-enter-forward", "nav-back": "page-enter-back", default: "page-enter" }}
      exit={{ "nav-forward": "page-exit-forward", "nav-back": "page-exit-back", default: "page-exit" }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
