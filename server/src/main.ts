import { SERVER_PORT } from "@runic/shared";
import { startServer } from "./server.ts";

await startServer(SERVER_PORT);
console.log(`server listening on ${SERVER_PORT}`);
