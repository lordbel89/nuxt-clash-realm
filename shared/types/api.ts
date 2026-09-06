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
}
