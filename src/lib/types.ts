export type DbEvent = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  location: string | null;
  content: string | null;
  teacher?: string | null;
  community_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type DbPhoto = {
  id: string;
  image_url: string;
  caption: string | null;
  is_approved?: boolean;
  community_id?: string | null;
  event_id?: string | null;
  created_at: string;
};

export type DbReflection = {
  id: string;
  title: string;
  content: string;
  quote: string | null;
  author: string | null;
  image_url: string | null;
  tags: string[] | null;
  community_id: string | null;
  course_id: string | null;
  created_at: string;
  updated_at: string;
};
