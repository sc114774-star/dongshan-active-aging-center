import { supabase } from "@/lib/supabase";
import type { DbEvent, DbPhoto, DbReflection } from "@/lib/types";
import { fallbackEvents, fallbackPhotos, fallbackReflections } from "@/lib/fallback";

function hasSupabaseConfig() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

export async function listPhotos(): Promise<DbPhoto[]> {
  if (!hasSupabaseConfig()) return fallbackPhotos;
  const { data, error } = await supabase
    .from("photos")
    .select("id,image_url,caption,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbPhoto[];
}

export async function listReflections(): Promise<DbReflection[]> {
  if (!hasSupabaseConfig()) return fallbackReflections;
  const { data, error } = await supabase
    .from("reflections")
    .select("id,title,content,quote,author,image_url,tags,school_year,location,created_at,updated_at")
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
    .select("id,title,date,location,content,created_at,updated_at")
    .gte("date", startYmd)
    .lte("date", endYmd)
    .order("date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as DbEvent[];
}
