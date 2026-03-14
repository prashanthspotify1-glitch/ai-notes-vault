"use client";

/**
 * Google Auth Provider
 *
 * Uses Google Identity Services (GIS) for OAuth 2.0 implicit grant flow.
 * This is the recommended client-side auth approach for SPAs that need
 * access tokens (not ID tokens via Sign In With Google).
 *
 * Trade-off: We use the implicit flow because the app needs a Drive
 * access_token on the client to make API calls directly. A server-side
 * auth code flow would be more secure for long-lived tokens but adds
 * significant backend complexity that is out of scope for this MVP.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { GoogleUser, AuthState } from "@/types";
import { GOOGLE_SCOPES } from "@/lib/constants";
import { getGoogleClientId } from "@/lib/env";

// ─── GIS type stubs (google.accounts.oauth2) ───────────────────────────────

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
}

interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
          }) => TokenClient;
          revoke: (token: string, done: () => void) => void;
        };
      };
    };
  }
}

// ─── Context ────────────────────────────────────────────────────────────────

interface AuthContextValue extends AuthState {
  signIn: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Verify a token has the required Drive scope by checking with Google's tokeninfo endpoint. */
async function verifyTokenScopes(token: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(token)}`
    );
    if (!res.ok) return false;
    const data = await res.json();
    const scopes: string = data.scope || "";
    const hasDrive = scopes.includes("drive");
    if (!hasDrive) {
      console.warn("[Auth] Token missing drive scope. Has:", scopes);
    }
    return hasDrive;
  } catch {
    return false;
  }
}

function clearSession() {
  sessionStorage.removeItem("gis_access_token");
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const tokenClientRef = useRef<TokenClient | null>(null);
  const scriptLoadedRef = useRef(false);

  // Fetch user info from Google with the access token
  const fetchUserInfo = useCallback(async (token: string) => {
    try {
      const res = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Failed to fetch user info");
      const data = await res.json();
      const googleUser: GoogleUser = {
        id: data.id,
        email: data.email,
        name: data.name,
        picture: data.picture,
      };
      setUser(googleUser);
      return googleUser;
    } catch {
      setUser(null);
      setAccessToken(null);
      clearSession();
      return null;
    }
  }, []);

  /** Validate a saved token: check it's not expired AND has drive scope. */
  const validateAndRestoreToken = useCallback(
    async (token: string): Promise<boolean> => {
      const hasScope = await verifyTokenScopes(token);
      if (!hasScope) {
        console.warn("[Auth] Saved token invalid or missing scopes, clearing.");
        clearSession();
        setUser(null);
        setAccessToken(null);
        return false;
      }
      setAccessToken(token);
      sessionStorage.setItem("gis_access_token", token);
      await fetchUserInfo(token);
      return true;
    },
    [fetchUserInfo]
  );

  // Initialize GIS token client once the script loads
  const initTokenClient = useCallback(() => {
    if (!window.google) return;

    const clientId = getGoogleClientId();
    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_SCOPES,
      callback: async (response: TokenResponse) => {
        if (response.error) {
          console.error("[Auth] OAuth error:", response.error);
          setIsLoading(false);
          return;
        }

        // Verify the granted scopes include drive access
        const grantedScopes = response.scope?.split(" ") ?? [];
        const hasDriveScope = grantedScopes.some((s) => s.includes("drive"));
        if (!hasDriveScope) {
          console.error(
            "[Auth] Drive scope not granted. Granted:",
            response.scope
          );
          setIsLoading(false);
          return;
        }

        setAccessToken(response.access_token);
        sessionStorage.setItem("gis_access_token", response.access_token);
        await fetchUserInfo(response.access_token);
        setIsLoading(false);
      },
    });
  }, [fetchUserInfo]);

  // Load the GIS script
  useEffect(() => {
    if (scriptLoadedRef.current) return;
    scriptLoadedRef.current = true;

    const restoreSession = async () => {
      const saved = sessionStorage.getItem("gis_access_token");
      if (saved) {
        const valid = await validateAndRestoreToken(saved);
        if (valid) {
          setIsLoading(false);
          return;
        }
      }
      setIsLoading(false);
    };

    const existing = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      initTokenClient();
      restoreSession();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      initTokenClient();
      restoreSession();
    };
    script.onerror = () => {
      console.error("[Auth] Failed to load Google Identity Services");
      setIsLoading(false);
    };
    document.head.appendChild(script);
  }, [initTokenClient, validateAndRestoreToken]);

  const signIn = useCallback(() => {
    if (!tokenClientRef.current) {
      console.error("[Auth] Token client not initialized");
      return;
    }
    // Clear any stale session before requesting new token
    clearSession();
    setIsLoading(true);
    tokenClientRef.current.requestAccessToken({ prompt: "consent" });
  }, []);

  const signOut = useCallback(() => {
    if (accessToken && window.google) {
      window.google.accounts.oauth2.revoke(accessToken, () => {});
    }
    setUser(null);
    setAccessToken(null);
    clearSession();
  }, [accessToken]);

  const value: AuthContextValue = {
    user,
    accessToken,
    isLoading,
    isAuthenticated: !!user && !!accessToken,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
