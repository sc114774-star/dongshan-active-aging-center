import { nanoid } from "nanoid";
import { supabase } from "@/lib/supabase";
import type { DbEvent, DbIntroImage, DbPhoto, DbReflection } from "@/lib/types";

const STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET ?? "senior-center-images";

export type EventInput = {
  title: string;
  date: string;
  location?: string | null;
  content?: string | null;
  teacher?: string | null;
  community_id?: string | null;
};

export type ReflectionInput = {
  title: string;
  content: string;
  quote?: string | null;
  author?: string | null;
  image_url?: string | null;
  tags?: string[] | null;
  community_id?: string | null;
  course_id?: string | null;
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

export async function createPhoto(input: { image_url: string; caption?: string | null; is_approved?: boolean; community_id?: string | null; event_id?: string | null }) {
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

// 由公開網址推回 Storage 內的檔案路徑
function storagePathFromUrl(url: string) {
  const marker = `/${STORAGE_BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
}

async function removeStorageFile(url: string) {
  const path = storagePathFromUrl(url);
  if (path) await supabase.storage.from(STORAGE_BUCKET).remove([path]);
}

export async function setPhotoEvent(id: string, eventId: string | null, caption?: string | null) {
  const patch: { event_id: string | null; caption?: string | null } = { event_id: eventId };
  if (caption !== undefined) patch.caption = caption;
  const { error } = await supabase.from("photos").update(patch).eq("id", id);
  if (error) throw error;
}

// 刪除資料列，並一併刪除 Storage 內的圖片檔
export async function deletePhoto(photo: { id: string; image_url: string }) {
  const { error } = await supabase.from("photos").delete().eq("id", photo.id);
  if (error) throw error;
  await removeStorageFile(photo.image_url).catch(() => undefined);
}

export async function createIntroImage(input: { image_url: string; caption?: string | null; community_id?: string | null }) {
  const { data, error } = await supabase.from("site_intro_images").insert(input).select().single();
  if (error) throw error;
  return data as DbIntroImage;
}

export async function deleteIntroImage(img: { id: string; image_url: string }) {
  const { error } = await supabase.from("site_intro_images").delete().eq("id", img.id);
  if (error) throw error;
  await removeStorageFile(img.image_url).catch(() => undefined);
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

export async function uploadImage(file: File, folder: "photos" | "reflections" | "intro") {
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
