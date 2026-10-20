/**
 * Il testo per l'utente di un errore della nostra API. Sta in `data.message`, sia nel `FetchError`
 * di `$fetch` sia nel `NuxtError` di `useFetch` (che tipizza `data` come `unknown`).
 * Mai `statusMessage`: è la reason phrase inglese.
 */
export function apiErrorMessage(error: unknown): string | undefined {
  return (error as { data?: { message?: string; }; } | null | undefined)?.data?.message;
}
