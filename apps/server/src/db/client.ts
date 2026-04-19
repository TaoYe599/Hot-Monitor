import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

export interface DatabaseConnection {
  client: Client;
  db: ReturnType<typeof drizzle>;
}

function toLibsqlUrl(databasePath: string): string {
  if (databasePath === ":memory:" || databasePath.startsWith("file:")) {
    return databasePath;
  }
  return `file:${databasePath}`;
}

export function createDatabaseConnection(databasePath: string): DatabaseConnection {
  if (databasePath !== ":memory:") {
    const normalizedPath = databasePath.startsWith("file:") ? databasePath.slice(5) : databasePath;
    mkdirSync(dirname(normalizedPath), { recursive: true });
  }

  const client = createClient({
    url: toLibsqlUrl(databasePath),
  });

  return {
    client,
    db: drizzle(client),
  };
}
