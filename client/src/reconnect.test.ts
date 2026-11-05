import { TAKEN_OVER_CLOSE_CODE } from "@runic/shared";
import { expect, test, vi } from "vitest";
import { isTakenOver, rejoin } from "./reconnect.ts";

const NO_WAIT = 0;

test("the same build rejoins without reloading", async () => {
  const reload = vi.fn();
  const room = await rejoin(
    "build-1",
    async () => "build-1",
    async () => "room",
    reload,
    NO_WAIT,
  );
  expect(room).toBe("room");
  expect(reload).not.toHaveBeenCalled();
});

test("a different build reloads the page and doesn't join", async () => {
  const join = vi.fn(async () => "room");
  const reloaded = new Promise<void>((resolve) => {
    void rejoin("build-1", async () => "build-2", join, resolve, NO_WAIT);
  });
  await reloaded;
  expect(join).not.toHaveBeenCalled();
});

test("it keeps trying while the server is down or not yet accepting joins", async () => {
  const version = vi
    .fn<() => Promise<string>>()
    .mockRejectedValueOnce(new Error("down"))
    .mockResolvedValue("build-1");
  const join = vi
    .fn<() => Promise<string>>()
    .mockRejectedValueOnce(new Error("no room yet"))
    .mockResolvedValue("room");

  expect(await rejoin("build-1", version, join, vi.fn(), NO_WAIT)).toBe("room");
  expect(version).toHaveBeenCalledTimes(3);
  expect(join).toHaveBeenCalledTimes(2);
});

test("a join replaced by a newer login stops, or trying again would kick that login", async () => {
  const replaced = { code: TAKEN_OVER_CLOSE_CODE };
  const join = vi.fn(() => Promise.reject(replaced));
  await expect(
    rejoin("build-1", async () => "build-1", join, vi.fn(), NO_WAIT),
  ).rejects.toBe(replaced);
  expect(join).toHaveBeenCalledTimes(1);
  expect(isTakenOver(replaced)).toBe(true);
  expect(isTakenOver(new Error("no room yet"))).toBe(false);
});

test("a dev build has no version, so it never reloads", async () => {
  const reload = vi.fn();
  const room = await rejoin(
    undefined,
    async () => "whatever vite answers",
    async () => "room",
    reload,
    NO_WAIT,
  );
  expect(room).toBe("room");
  expect(reload).not.toHaveBeenCalled();
});
