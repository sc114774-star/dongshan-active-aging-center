export type DbEvent = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  location: string | null;
  content: string | null;
  created_at: string;
  updated_at: string;
};

export type DbPhoto = {
  id: string;
  image_url: string;
  caption: string | null;
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
  created_at: string;
  updated_at: string;
};
