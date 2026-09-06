/**
 * Tutti gli endpoint di Better Auth: /api/auth/sign-in/email, /sign-up/email,
 * /sign-out, /get-session… Le risposte e gli errori sono nel formato della
 * libreria, non in quello del resto dell'API: è il perimetro dichiarato in
 * server/auth/index.ts.
 */
export default defineEventHandler(async (event) => {
  const auth = await useAuth();

  return auth.handler(toWebRequest(event));
});
