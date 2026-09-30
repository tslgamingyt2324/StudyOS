import "fake-indexeddb/auto";
import { vi } from "vitest";

// Minimal browser APIs jsdom lacks.
Object.defineProperty(window, "matchMedia", { value: (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) });
window.HTMLElement.prototype.scrollIntoView = () => {};
(globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

export const nav = { pathname: "/", search: "", params: {} as Record<string, string> };
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.search),
  useParams: () => nav.params,
  redirect: vi.fn(),
}));
