/**
 * Browser-side auth client.
 *
 * Safe to import from Client Components — it holds no secrets, it only calls
 * the /api/auth/* routes. The server instance in ./index.ts must never be
 * imported into client code.
 */
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export const { signIn, signOut, useSession } = authClient;
