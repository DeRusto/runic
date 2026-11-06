// Dev-only: `npx vite client/render-icons`. The player's build (`vite build client`) only takes client/index.html, so none of this ships.
import { writeFileSync } from "node:fs";
import { defineConfig } from "vite";

const ICONS = new URL("../public/icons/", import.meta.url);

export default defineConfig({
  // shortcut: the owner's art packs, served whole, only work on this machine; see spec §7.
  publicDir: "C:/Users/derus/Game Assets",
  server: {
    watch: null, // the packs hold about 92,000 files
  },
  plugins: [
    {
      name: "save-icon",
      configureServer(server) {
        server.middlewares.use("/save", (request, response) => {
          if (request.method !== "POST") {
            response.statusCode = 405;
            return response.end();
          }
          const name = request.url!.slice(1);
          if (!/^\w+\.png$/.test(name)) {
            response.statusCode = 400;
            return response.end();
          }
          const chunks: Buffer[] = [];
          request.on("data", (chunk) => chunks.push(chunk));
          request.on("end", () => {
            const png = Buffer.concat(chunks);
            if (png.length === 0) {
              response.statusCode = 400;
              return response.end();
            }
            writeFileSync(new URL(name, ICONS), png);
            response.end();
          });
        });
      },
    },
  ],
});
