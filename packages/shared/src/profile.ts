export type Language = "en" | "ar";

/** Chosen by the person. Only changes colours and the grammar of Arabic sentences; "unspecified" is a normal choice. */
export type Gender = "male" | "female" | "unspecified";
export const GENDERS: readonly Gender[] = ["male", "female", "unspecified"];

/** A row of `public.profiles`. */
export type Profile = {
  id: string;
  email: string | null;
  preferred_language: Language;
  display_name: string | null;
  gender: Gender;
  account_status: "active" | "suspended" | "deleted";
  is_demo: boolean;
  created_at: string;
};
