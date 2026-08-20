export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://yyrpennpmwajlbepoemt.supabase.co';

export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_MqRENyYWAfY9WcFMOkG0mQ_zgQk5IXs';

export const supabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);
