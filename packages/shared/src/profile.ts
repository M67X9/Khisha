export type Language = "en" | "ar";

/** A row of `public.profiles`. */
export type Profile = {
  id: string;
  email: string | null;
  preferred_language: Language;
  account_status: "active" | "suspended" | "deleted";
  is_demo: boolean;
  created_at: string;
};
