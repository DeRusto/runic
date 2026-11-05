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
