const authWhitelist = ['/login', '/dev/components'];

/**
 * Protegge una pagina: global middleware.
 * `useFetch` passato a `useSession` fa sì che la sessione sia letta lato
 * server con i cookie della richiesta e riusata in idratazione.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (authWhitelist.includes(to.path)) {
    return;
  }

  const { data: session } = await authClient.useSession(useFetch);

  if (!session.value) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } });
  }
});
