/**
 * Protegge una pagina: `definePageMeta({ middleware: 'auth' })`.
 * `useFetch` passato a `useSession` fa sì che la sessione sia letta lato
 * server con i cookie della richiesta e riusata in idratazione.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { data: session } = await authClient.useSession(useFetch);

  if (!session.value) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } });
  }
});
