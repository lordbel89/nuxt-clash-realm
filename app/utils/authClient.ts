import { createAuthClient } from 'better-auth/vue';

/**
 * Client di Better Auth: `signIn`, `signOut`, `useSession`.
 * Auto-importato come tutto ciò che sta in app/utils.
 *
 * Parla solo con /api/auth/**, che ha un contratto suo: gli errori arrivano
 * come `{ error: { code, message } }`, non nella forma di `ApiErrorData`.
 */
export const authClient = createAuthClient();
