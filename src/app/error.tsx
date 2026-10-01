"use client";

/** Route-level error boundary: a runtime error shows a recoverable screen instead of a blank page. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-bold">Something went wrong</h1>
      <p className="text-sm text-ink-muted">Your data is safe on this device. {error.message ? `(${error.message})` : ""}</p>
      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={reset}>Try again</button>
        <button className="btn btn-secondary" onClick={() => window.location.assign("/")}>Go to Home</button>
      </div>
    </div>
  );
}
