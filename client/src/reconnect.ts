const RETRY_MS = 1000;

/** What the server is serving now. Throws while it, or the proxy in front of it, can't say. */
export async function servedVersion() {
  const res = await fetch("/version.txt", { cache: "no-store" });
  if (!res.ok) throw new Error(`version.txt: ${res.status}`);
  return (await res.text()).trim();
}

/**
 * Waits out a restart, then joins again, or reloads if a new build came up. A failed
 * join is retried too: a server that is stopping or just started refuses it.
 */
export async function rejoin<T>(
  build: string | undefined,
  version: () => Promise<string>,
  join: () => Promise<T>,
  reload: () => void,
  retryMs = RETRY_MS,
): Promise<T> {
  for (;;) {
    try {
      const served = await version();
      if (build && served !== build) {
        reload();
        return new Promise<T>(() => {}); // the page is going away
      }
      return await join();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, retryMs));
    }
  }
}
