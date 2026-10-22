import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Copia in `<destinazione>/node_modules` i pacchetti che servono agli script di rilascio
 * (`server/database/migrate.ts`, `grant.ts`, `scripts/user-create.ts`) e tutte le loro dipendenze,
 * scegliendo le versioni esatte che il lockfile ha già installato in `node_modules`. Lo usa il
 * Dockerfile: rifare `npm install` dei soli cinque pacchetti rimetterebbe in discussione le versioni
 * dei pacchetti da cui dipendono, e darebbe un albero diverso da quello che abbiamo provato.
 *
 *     node scripts/runtime-deps.ts /tools
 */

const ROOTS = ['drizzle-orm', 'postgres', 'better-auth', '@better-auth/drizzle-adapter', 'valibot'];

interface LockedPackage {
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean; }>;
}

/** Il percorso (nel lockfile) del pacchetto `name` quando lo chiede quello in `from`: il più vicino vince, come in Node. */
export function resolveLocked(packages: Record<string, unknown>, from: string, name: string): string | null {
  let base = from;

  while (true) {
    const candidate = base ? `${base}/node_modules/${name}` : `node_modules/${name}`;
    if (candidate in packages) return candidate;
    if (!base) return null;

    const cut = base.lastIndexOf('/node_modules/');
    base = cut === -1 ? '' : base.slice(0, cut);
  }
}

/** Tutti i percorsi del lockfile raggiunti dai `roots`, dipendenze necessarie comprese. */
export function collect(packages: Record<string, LockedPackage>, roots: string[]) {
  const seen = new Set<string>();
  const queue = roots.map((name) => {
    const path = resolveLocked(packages, '', name);
    if (!path) throw new Error(`${name} non è nel lockfile`);
    return path;
  });

  for (let path = queue.pop(); path !== undefined; path = queue.pop()) {
    if (seen.has(path)) continue;
    seen.add(path);

    const entry = packages[path]!;
    const required = Object.keys({ ...entry.dependencies, ...entry.optionalDependencies });
    const peers = Object.keys(entry.peerDependencies ?? {}).filter(name => !entry.peerDependenciesMeta?.[name]?.optional);

    for (const name of [...required, ...peers]) {
      const found = resolveLocked(packages, path, name);
      if (found) queue.push(found);
    }
  }

  return [...seen].sort();
}

function main() {
  const destination = process.argv[2];
  if (!destination) {
    console.error('Uso: node scripts/runtime-deps.ts <cartella di destinazione>');
    process.exit(1);
  }

  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')) as { packages: Record<string, LockedPackage>; };
  let copied = 0;

  for (const path of collect(lock.packages, ROOTS)) {
    // Le varianti per altre piattaforme sono nel lockfile ma non su disco: non servono
    if (!existsSync(path)) continue;

    const target = join(destination, path);
    mkdirSync(target, { recursive: true });
    // Il pacchetto senza i suoi `node_modules` annidati: quelli sono pacchetti a sé nell'elenco
    cpSync(path, target, { recursive: true, filter: source => !source.slice(path.length).includes('node_modules') });
    copied++;
  }

  console.info(`${copied} pacchetti copiati in ${destination}/node_modules`);
}

// Importabile dai test senza eseguire la copia
if (process.argv[1] && import.meta.filename === process.argv[1]) main();
