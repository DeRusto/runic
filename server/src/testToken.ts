/** A token for a new account on a test server; the room refuses joins without one. */
export async function testToken(port: number, username = "Tester") {
  const res = await fetch(`http://localhost:${port}/api/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username,
      password: "test-password",
      inviteCode: process.env.INVITE_CODE,
    }),
  });
  const { token } = await res.json();
  return token as string;
}

/**
 * A port the system has free right now, for a test server. Picking one by process id could land
 * on a port Windows reserves or another program holds, and the server then failed to start.
 */
export async function freePort() {
  const { createServer } = await import("node:net");
  return new Promise<number>((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });
}
