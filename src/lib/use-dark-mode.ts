"use client";

import { useSyncExternalStore } from "react";

const THEME_CHANGE_EVENT = "elite-gamma-theme-change";
let darkModeSnapshot: boolean | null = null;

function subscribe(onStoreChange: () => void) {
  const handleThemeChange = (event: Event) => {
    const detail = (event as CustomEvent<{ darkMode?: boolean }>).detail;
    darkModeSnapshot =
      typeof detail?.darkMode === "boolean"
        ? detail.darkMode
        : window.localStorage.getItem("elite-gamma-theme") === "dark";
    onStoreChange();
  };

  window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
}

function getSnapshot() {
  if (darkModeSnapshot === null) {
    darkModeSnapshot = window.localStorage.getItem("elite-gamma-theme") === "dark";
  }
  return darkModeSnapshot;
}

function getServerSnapshot() {
  return false;
}

export function useDarkMode() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
