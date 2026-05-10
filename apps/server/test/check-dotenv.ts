/**
 * Quick test - verify Twitter API key loading.
 */
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
// apps/server/test/ -> project root = 3 levels up
const rootEnv = path.resolve(__dirname, "../../../.env");
console.log("Loading .env from:", rootEnv);

config({ path: rootEnv });

const key = process.env.TWITTERAPI_IO_KEY;
console.log("TWITTERAPI_IO_KEY:", key ? key.slice(0, 10) + "..." : "NOT SET");

if (key) {
  console.log("\nTesting Twitter API...");
  try {
    const res = await fetch(
      "https://api.twitterapi.io/twitter/tweet/advanced_search?query=AI&queryType=Latest",
      {
        headers: { "x-api-key": key },
        signal: AbortSignal.timeout(20000),
      }
    );
    const text = await res.text();
    console.log("Twitter API status:", res.status);
    console.log("Response (first 300 chars):", text.slice(0, 300));
  } catch (e) {
    console.error("Twitter API error:", e instanceof Error ? e.message : String(e));
  }
} else {
  console.log("No API key, skipping Twitter test");
}
