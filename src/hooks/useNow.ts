"use client";
import { useSyncExternalStore } from "react";

/**
 * One shared clock for every time-sensitive screen (current class, countdowns).
 * - A single timer serves all subscribers and only runs while something is subscribed.
 * - Subscribers re-render only when the minute changes — or immediately when the
 *   app returns from the background (visibilitychange / pageshow / focus), because
 *   phones freeze timers while a page is suspended.
 */
let current = new Date();
const subscribers = new Set<() => void>();
let timer: number | undefined;

function refresh(force: boolean) {
  const next = new Date();
  const sameMinute = Math.floor(next.getTime() / 60_000) === Math.floor(current.getTime() / 60_000);
  if (sameMinute && !force) return;
  current = next;
  subscribers.forEach((fn) => fn());
}
const onResume = () => { if (document.visibilityState !== "hidden") refresh(true); };

function subscribe(fn: () => void) {
  subscribers.add(fn);
  if (subscribers.size === 1) {
    timer = window.setInterval(() => refresh(false), 15_000);
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("focus", onResume);
    window.addEventListener("pageshow", onResume);
    refresh(true); // the stored value may be stale from the last time anyone was subscribed
  }
  return () => {
    subscribers.delete(fn);
    if (subscribers.size === 0) {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("focus", onResume);
      window.removeEventListener("pageshow", onResume);
    }
  };
}

export function useNow(): Date {
  return useSyncExternalStore(subscribe, () => current, () => current);
}
