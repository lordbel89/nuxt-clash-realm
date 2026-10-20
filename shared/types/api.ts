/**
 * Forme trasversali del contratto: valgono per ogni entità, quindi stanno qui
 * e non in `shared/types/<entità>.ts`.
 */

/** Risposta di ogni endpoint di elenco: mai un array nudo, così la paginazione non è un cambio di forma successivo. */
export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Payload di `createError({ data })` per gli errori di validazione.
 * Tipizzarlo serve al frontend: `useFetch` espone un `FetchError<ApiErrorData>`
 * e i messaggi tornano nel form senza passare da `any`.
 */
export interface ApiErrorData {
  /** Messaggi per campo, nella forma `{ email: ['Indirizzo email non valido'] }` */
  fields?: Record<string, readonly string[] | undefined>;
  /**
   * Messaggi che non appartengono a nessun campo: body vuoto, non-oggetto o
   * array. Senza di questi il client riceverebbe un 400 con `fields` vuoto e
   * non avrebbe niente da mostrare.
   */
  messages?: readonly string[];
}

/**
 * Codici stabili degli avvisi: il frontend può farci uno switch esaustivo.
 * Ogni codice si aggiunge nello step che lo introduce, e il suo arrivo è un cambio di
 * contratto (voce in docs/api/CHANGELOG.md). Oggi nessun comando avvisa.
 */
export type ApiWarningCode = never;

/**
 * Un avviso che non impedisce il comando: rivincita, secondo bye, round oltre il limite,
 * profilo di un minore. Il comando è riuscito; l'avviso va mostrato.
 */
export interface ApiWarning {
  code: ApiWarningCode;
  /** Testo in italiano per l'utente */
  message: string;
}

/**
 * Risposta `200` di un comando che può avvisare. `warnings` c'è sempre, vuoto se non ci sono
 * avvisi: la forma non cambia da una risposta all'altra della stessa rotta.
 */
export interface WithWarnings<T> {
  data: T;
  warnings: ApiWarning[];
}
