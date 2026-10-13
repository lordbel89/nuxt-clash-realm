import { type ChildProcess, spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { MIGRATIONS_FOLDER } from './database.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const NUXT_BIN = join(ROOT, 'node_modules/nuxt/bin/nuxt.mjs');
const READY_TIMEOUT_MS = 120_000;

export interface TestServer {
  /** Origine del server, senza barra finale: `http://localhost:41234`. */
  url: string;
  /** Spegne il server e cancella il suo database. */
  stop: () => Promise<void>;
}

/**
 * Il server per i test [S]: `nuxt dev` su un database PGlite nuovo, con le migrazioni applicate,
 * su una porta libera.
 *
 * - I mock sono spenti (`NUXT_MOCKS=false`): risponde solo il backend vero.
 * - `--envName scenario` dà al server una cartella di build sua (vedi `$env` in nuxt.config.ts),
 *   così non riscrive `.nuxt/` sotto un dev server già acceso. Per lo stesso motivo i file [S]
 *   girano uno alla volta (`--test-concurrency=1`).
 */
export async function startTestServer(): Promise<TestServer> {
  const dataDir = await mkdtemp(join(tmpdir(), 'clash-scenario-'));

  // Migrazioni applicate prima dell'avvio, poi la cartella passa al server
  const setup = drizzle({ connection: { dataDir } });
  await migrate(setup, { migrationsFolder: MIGRATIONS_FOLDER });
  await setup.$client.close();

  const port = await freePort();
  const url = `http://localhost:${port}`;

  // Processo capogruppo: `nuxt dev` avvia un figlio, e lo stop deve chiudere entrambi
  const child = spawn(process.execPath, [NUXT_BIN, 'dev', '--port', String(port), '--envName', 'scenario'], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NUXT_DATABASE_DIALECT: 'pglite',
      NUXT_DATABASE_PGLITE_PATH: dataDir,
      NUXT_AUTH_URL: url,
      NUXT_MOCKS: 'false',
    },
  });

  let log = '';
  child.stdout!.on('data', (chunk) => (log += chunk));
  child.stderr!.on('data', (chunk) => (log += chunk));

  const stop = async () => {
    await kill(child);
    await rm(dataDir, { recursive: true, force: true });
  };

  try {
    await waitUntilReady(url, child);
  }
  catch (error) {
    await stop();
    throw new Error(`Il server di test non è partito.\n--- output di nuxt dev ---\n${log}`, { cause: error });
  }

  return { url, stop };
}

/** Pronto quando un handler vero risponde: prima, `nuxt dev` serve una pagina d'attesa. */
async function waitUntilReady(url: string, child: ChildProcess) {
  const deadline = Date.now() + READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`nuxt dev è uscito con codice ${child.exitCode}`);

    try {
      const response = await fetch(`${url}/api/users/me`);
      if (response.status === 401) return;
    }
    catch {
      // Porta non ancora in ascolto
    }

    await new Promise(resolve => setTimeout(resolve, 250));
  }

  throw new Error(`nessuna risposta entro ${READY_TIMEOUT_MS / 1000} secondi`);
}

function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, () => {
      const { port } = server.address() as { port: number; };
      server.close(() => resolve(port));
    });
  });
}

async function kill(child: ChildProcess) {
  if (child.exitCode !== null || child.pid === undefined) return;

  const exited = new Promise(resolve => child.once('exit', resolve));
  process.kill(-child.pid, 'SIGTERM');
  await exited;
}
