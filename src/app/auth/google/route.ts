import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${requestUrl.origin}/auth/callback`,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    const loginUrl = new URL('/login', requestUrl.origin);
    loginUrl.searchParams.set('error', 'oauth');
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(data.url);
}
