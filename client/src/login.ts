import { type Client, ErrorCode } from "@colyseus/sdk";
import { WORLD_ROOM } from "@runic/shared";
import type { WorldRoom } from "../../server/src/WorldRoom.ts";

const TOKEN_KEY = "runic.token";

function storedToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // blocked storage only means logging in again next visit
  }
}

function askForToken() {
  return new Promise<string>((resolve) => {
    const form = document.createElement("form");
    form.style.cssText =
      "position:fixed;inset:0;margin:auto;width:min(280px,calc(100vw - 32px));height:fit-content;" +
      "display:grid;gap:8px;padding:16px;background:#fff;color:#111;border:1px solid #888;" +
      "font-family:system-ui,sans-serif";
    form.innerHTML = `
      <label>Username <input name="username" autocomplete="username" required style="width:100%;box-sizing:border-box" /></label>
      <label>Password <input name="password" type="password" required style="width:100%;box-sizing:border-box" /></label>
      <label>Invite code <input name="inviteCode" autocomplete="off" style="width:100%;box-sizing:border-box" /></label>
      <p role="alert" style="margin:0;color:#b00020"></p>
      <button type="submit"></button>
      <button type="button"></button>
    `;
    const inviteLabel = form.querySelector<HTMLLabelElement>(
      "label:nth-of-type(3)",
    )!;
    const invite = form.elements.namedItem("inviteCode") as HTMLInputElement;
    const password = form.elements.namedItem("password") as HTMLInputElement;
    const alert = form.querySelector("p")!;
    const [submit, toggle] = form.querySelectorAll("button");

    let registering = false;
    function show() {
      inviteLabel.hidden = !registering;
      invite.required = registering;
      password.autocomplete = registering ? "new-password" : "current-password";
      submit!.textContent = registering ? "Register" : "Log in";
      toggle!.textContent = registering
        ? "I have an account"
        : "I have an invite code";
      alert.textContent = "";
    }
    show();
    toggle!.onclick = () => {
      registering = !registering;
      show();
    };

    form.onsubmit = async (event) => {
      event.preventDefault();
      const { username, password, inviteCode } = Object.fromEntries(
        new FormData(form),
      );
      alert.textContent = "";
      submit!.disabled = true;
      try {
        const res = await fetch(registering ? "/api/register" : "/api/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            registering
              ? { username, password, inviteCode }
              : { username, password },
          ),
        });
        const body = await res.json();
        if (res.ok) {
          form.remove();
          resolve(body.token);
        } else {
          alert.textContent = body.message ?? "That didn't work";
        }
      } catch {
        alert.textContent = "Can't reach the server";
      } finally {
        submit!.disabled = false;
      }
    };
    document.body.append(form);
  });
}

/** Joins the world with the stored token, showing the form until one is accepted. */
export async function joinWorld(client: Client) {
  for (;;) {
    const token = storedToken() ?? (await askForToken());
    storeToken(token);
    client.auth.token = token;
    try {
      return await client.join<WorldRoom>(WORLD_ROOM);
    } catch (error) {
      if ((error as { code?: number }).code !== ErrorCode.AUTH_FAILED)
        throw error;
      // expired, or the account was cut off
      storeToken(null);
    }
  }
}
