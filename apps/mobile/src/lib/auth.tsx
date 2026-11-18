import type { Gender, Profile } from "@khisha/shared";
import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { MessageKey } from "../i18n";
import { authErrorKey } from "./authErrors";
import { supabase } from "./supabase";

export type AuthResult = { ok: true; needsEmailConfirmation?: boolean } | { ok: false; messageKey: MessageKey };

type AuthState = {
  session: Session | null;
  /** true until the saved session (if any) has been read from storage */
  loading: boolean;
  profile: Profile | null;
  profileError: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, details: { displayName: string; gender: Gender }) => Promise<AuthResult>;
  /** Saves the name and/or gender. Returns false when it could not be saved. */
  updateProfile: (patch: { display_name?: string; gender?: Gender }) => Promise<boolean>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session);
      })
      .catch(() => {
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Load the profile row (created by a database trigger at sign-up) whenever the signed-in user changes.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setProfileError(false);
      return;
    }
    let active = true;
    supabase
      .from("profiles")
      .select("id,email,preferred_language,display_name,gender,account_status,is_demo,created_at")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        setProfile((data as Profile | null) ?? null);
        setProfileError(Boolean(error) || !data);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? { ok: false, messageKey: authErrorKey(error) } : { ok: true };
  }, []);

  const signUp = useCallback(async (email: string, password: string, details: { displayName: string; gender: Gender }): Promise<AuthResult> => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: details.displayName.trim(), gender: details.gender } },
    });
    if (error) return { ok: false, messageKey: authErrorKey(error) };
    // With email confirmation on, an existing address returns a user with no identities and no error.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      return { ok: false, messageKey: "authErr.exists" };
    }
    return { ok: true, needsEmailConfirmation: !data.session };
  }, []);

  const updateProfile = useCallback(
    async (patch: { display_name?: string; gender?: Gender }): Promise<boolean> => {
      if (!userId) return false;
      const { data, error } = await supabase.from("profiles").update(patch).eq("id", userId).select("id,email,preferred_language,display_name,gender,account_status,is_demo,created_at").maybeSingle();
      if (error || !data) return false;
      setProfile(data as Profile);
      return true;
    },
    [userId],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthState>(
    () => ({ session, loading, profile, profileError, signIn, signUp, updateProfile, signOut }),
    [session, loading, profile, profileError, signIn, signUp, updateProfile, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
