const http = require("http");

const BACKEND_URL = "http://localhost:3001";
const MAX_WAIT = 30000;
const INTERVAL = 500;

function waitForBackend() {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    function tryConnect() {
      const req = http.get(BACKEND_URL + "/api/health", (res) => {
        console.log("\n[wait-backend] Backend ready at", BACKEND_URL);
        resolve();
      });

      req.on("error", (err) => {
        const elapsed = Date.now() - start;

        if (elapsed >= MAX_WAIT) {
          console.error("\n[wait-backend] ERROR: Backend not ready after 30 seconds!");
          console.error("[wait-backend] If you're seeing this repeatedly, check for zombie processes:");
          console.error("  netstat -ano | findstr :3001");
          console.error("  taskkill /PID <PID> /F");
          console.error("[wait-backend] Alternatively, kill all node processes:");
          console.error("  taskkill /IM node.exe /F");
          resolve(); // Still resolve so vite doesn't fail
          return;
        }

        process.stdout.write(".");
        setTimeout(tryConnect, INTERVAL);
      });

      req.setTimeout(1000, () => {
        req.destroy();
        if (Date.now() - start < MAX_WAIT) {
          setTimeout(tryConnect, INTERVAL);
        }
      });
    }

    console.log("[wait-backend] Waiting for backend at", BACKEND_URL);
    tryConnect();
  });
}

waitForBackend().then(() => {
  process.exit(0);
});
