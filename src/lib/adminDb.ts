import { nanoid } from "nanoid";
import { supabase } from "@/lib/supabase";
import type { DbEvent, DbPhoto, DbReflection } from "@/lib/types";

const STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET ?? "senior-center-images";

export type EventInput = {
  title: string;
  date: string;
  location?: string | null;
  content?: string | null;
  teacher?: string | null;
};

export type ReflectionInput = {
  title: string;
  content: string;
  quote?: string | null;
  author?: string | null;
  image_url?: string | null;
  tags?: string[] | null;
  school_year?: string | null;
  location?: string | null;
};

export async function createEvent(input: EventInput) {
  const { data, error } = await supabase.from("events").insert(input).select().single();
  if (error) throw error;
  return data as DbEvent;
}

export async function updateEvent(id: string, input: EventInput) {
  const { data, error } = await supabase.from("events").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as DbEvent;
}

export async function deleteEvent(id: string) {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw error;
}

export async function createPhoto(input: { image_url: string; caption?: string | null; is_approved?: boolean }) {
  // 後台自己上傳的照片預設直接核准；快速上傳頁則一律為 false
  const { data, error } = await supabase
    .from("photos")
    .insert({ is_approved: true, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as DbPhoto;
}

export async function setPhotoApproved(id: string, approved: boolean) {
  const { error } = await supabase.from("photos").update({ is_approved: approved }).eq("id", id);
  if (error) throw error;
}

export async function deletePhoto(id: string) {
  const { error } = await supabase.from("photos").delete().eq("id", id);
  if (error) throw error;
}

export async function createReflection(input: ReflectionInput) {
  const { data, error } = await supabase.from("reflections").insert(input).select().single();
  if (error) throw error;
  return data as DbReflection;
}

export async function updateReflection(id: string, input: ReflectionInput) {
  const { data, error } = await supabase
    .from("reflections")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbReflection;
}

export async function deleteReflection(id: string) {
  const { error } = await supabase.from("reflections").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadImage(file: File, folder: "photos" | "reflections") {
  if (!file.type.startsWith("image/")) {
    throw new Error("請上傳圖片檔案");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "png";
  const safeExt = extension.replace(/[^a-z0-9]/g, "") || "png";
  const path = `${folder}/${Date.now()}-${nanoid(8)}.${safeExt}`;

  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
