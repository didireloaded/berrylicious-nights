/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_HERO_VIDEO_URL?: string;
  /** Dev only: comma-separated emails treated as admin without user_roles row */
  readonly VITE_DEV_ADMIN_EMAILS?: string;
}
