import { SERVER_PORT } from "@runic/shared";
import { defineConfig } from "vite";

const target = `http://127.0.0.1:${SERVER_PORT}`;

export default defineConfig({
  server: {
    proxy: {
      "/matchmake": target,
      "/api": target,
      // The room socket is /<processId>/<roomId>?<query>, with no fixed prefix.
      "^/[\\w-]+/[\\w-]+\\?": { target, ws: true },
    },
  },
});
