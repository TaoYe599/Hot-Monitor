import { buildApp } from "./app.js";

const { app, services, config } = await buildApp();

await app.listen({
  host: "0.0.0.0",
  port: config.port,
});

services.scheduler.start();

console.log(`Hot Monitor server listening on ${config.publicUrl}`);
