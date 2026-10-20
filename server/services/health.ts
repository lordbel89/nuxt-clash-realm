import { sql } from 'drizzle-orm';
import type { Database } from '../database/client.ts';

const TIMEOUT_MS = 3000;

/**
 * Il database risponde? Una query banale con un limite di tempo: un database appeso non deve
 * appendere anche il controllo di salute. Lancia se non risponde.
 */
export async function checkDatabase(db: Database, timeoutMs = TIMEOUT_MS) {
  let timer: NodeJS.Timeout | undefined;

  try {
    await Promise.race([
      db.execute(sql`SELECT 1`),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Il database non risponde entro ${timeoutMs} ms`)), timeoutMs);
      }),
    ]);
  }
  finally {
    clearTimeout(timer);
  }
}
