/**
 * Mounts every Better Auth endpoint under /api/auth/*.
 *
 * The catch-all segment is required: sign-in, the Google callback, session
 * lookup and sign-out are all separate paths handled by one instance. The
 * Google redirect URI registered in Google Cloud Console must point here:
 *   {BETTER_AUTH_URL}/api/auth/callback/google
 */
import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/auth";

export const { GET, POST } = toNextJsHandler(auth);
