/** How to close each open room's Smithing panel, pile window and social panel. */
const closers = new Set<() => void>();

/**
 * Smithing, the pile window and the social panel share the left of the screen, so opening
 * one closes the others. Registers `close`, and returns what to call on opening and on leaving.
 */
export function leftPanel(close: () => void) {
  closers.add(close);
  return {
    opening: () => {
      for (const other of closers) if (other !== close) other();
    },
    forget: () => closers.delete(close),
  };
}
