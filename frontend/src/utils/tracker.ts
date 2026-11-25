import { api } from "../api/client";
import type { GradeLevel } from "../api/types";

const VISITOR_STORAGE_KEY = "scilingo_visitor_id";
let lastTrackedKey = "";
let lastTrackedAt = 0;

function getOrCreateVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_STORAGE_KEY);
    if (existing && existing.length >= 4) return existing;
    const generated =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `v-${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
    localStorage.setItem(VISITOR_STORAGE_KEY, generated);
    return generated;
  } catch {
    return "anon-session";
  }
}

function detectDeviceType(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w < 768) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

export function trackPageView(
  path: string,
  grade?: GradeLevel,
  eventType: "page_view" | "lesson_view" | "game_play" | "cms_view" = "page_view"
): void {
  const now = Date.now();
  const dedupeKey = `${eventType}:${path}:${grade ?? ""}`;
  if (dedupeKey === lastTrackedKey && now - lastTrackedAt < 2000) {
    return;
  }
  lastTrackedKey = dedupeKey;
  lastTrackedAt = now;

  void api
    .trackAccessEvent({
      visitor_id: getOrCreateVisitorId(),
      event_type: eventType,
      path,
      grade,
      device_type: detectDeviceType(),
      referrer: typeof document !== "undefined" && document.referrer ? document.referrer : null,
    })
    .catch(() => {
      // Never let telemetry failures disrupt student or teacher UX.
    });
}
