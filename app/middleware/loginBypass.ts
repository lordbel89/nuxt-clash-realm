export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path !== '/login') {
    return;
  }
  const { data: session } = await authClient.useSession(useFetch);

  if (session.value) {
    return navigateTo({ path: '/' });
  }
});
