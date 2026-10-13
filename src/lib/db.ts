import { supabase } from "@/lib/supabase";
import type { DbCourse, DbEvent, DbIntroImage, DbPhoto, DbReflection } from "@/lib/types";
import { fallbackEvents, fallbackPhotos, fallbackReflections } from "@/lib/fallback";

function hasSupabaseConfig() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

export async function listPhotos(): Promise<DbPhoto[]> {
  if (!hasSupabaseConfig()) return fallbackPhotos;
  const { data, error } = await supabase
    .from("photos")
    .select("id,image_url,caption,is_approved,community_id,event_id,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbPhoto[];
}

export async function listReflections(): Promise<DbReflection[]> {
  if (!hasSupabaseConfig()) return fallbackReflections;
  const { data, error } = await supabase
    .from("reflections")
    .select("id,title,content,quote,author,image_url,tags,community_id,course_id,created_at,updated_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbReflection[];
}

export async function listEventsBetween(startYmd: string, endYmd: string): Promise<DbEvent[]> {
  if (!hasSupabaseConfig()) {
    return fallbackEvents.filter((e) => e.date >= startYmd && e.date <= endYmd);
  }

  const { data, error } = await supabase
    .from("events")
    .select("id,title,date,location,content,teacher,community_id,created_at,updated_at")
    .gte("date", startYmd)
    .lte("date", endYmd)
    .order("date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as DbEvent[];
}

export async function listAllCourses(): Promise<DbCourse[]> {
  if (!hasSupabaseConfig()) return [];
  const { data, error } = await supabase
    .from("events")
    .select("id,title,date,community_id")
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbCourse[];
}

export async function listIntroImages(): Promise<DbIntroImage[]> {
  if (!hasSupabaseConfig()) return [];
  const { data, error } = await supabase
    .from("site_intro_images")
    .select("id,community_id,image_url,caption,created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbIntroImage[];
}

export async function getAboutPage(): Promise<{ title: string; content: string } | null> {
  if (!hasSupabaseConfig()) return null;
  const { data } = await supabase.from("about_page").select("title,content").eq("id", 1).maybeSingle();
  return data ?? null;
}
