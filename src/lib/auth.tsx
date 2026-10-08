import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type Community = { id: string; name: string; slug: string; login_email: string };
export type Profile = {
  id: string;
  role: "admin" | "community";
  community_id: string | null;
  display_name: string | null;
};

// 登入下拉選單中「總管理員」的選項值；管理員不在 communities 清單內
export const ADMIN_TARGET = "admin";
const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL as string | undefined) ?? "admin@dongshan-leling.tw";

type AuthValue = {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  /** 社區帳號所屬社區 id；管理員為 null */
  myCommunityId: string | null;
  communities: Community[];
  communityName: (id: string | null | undefined) => string;
  signIn: (target: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setSessionLoading(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    supabase
      .from("communities")
      .select("id,name,slug,login_email")
      .order("display_order", { ascending: true })
      .then(({ data }) => setCommunities((data ?? []) as Community[]));
  }, []);

  // 取得登入者的角色與所屬社區（不要在 onAuthStateChange 內直接 await 查詢，避免卡死）
  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    supabase
      .from("profiles")
      .select("id,role,community_id,display_name")
      .eq("id", uid)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setProfile((data as Profile | null) ?? null);
        setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const signIn = useCallback(
    async (target: string, password: string) => {
      const email =
        target === ADMIN_TARGET ? ADMIN_EMAIL : communities.find((c) => c.id === target)?.login_email;
      if (!email) throw new Error("請先選擇要登入的社區或管理員");
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw new Error(error.message.toLowerCase().includes("invalid login") ? "密碼錯誤" : error.message);
      }
    },
    [communities],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      loading: sessionLoading || profileLoading,
      session,
      profile,
      isAdmin: profile?.role === "admin",
      myCommunityId: profile?.role === "community" ? profile.community_id : null,
      communities,
      communityName: (id) => communities.find((c) => c.id === id)?.name ?? "",
      signIn,
      signOut,
    }),
    [sessionLoading, profileLoading, session, profile, communities, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth 必須在 AuthProvider 內使用");
  return ctx;
}
