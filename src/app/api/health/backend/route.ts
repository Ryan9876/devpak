import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseConfigured, supabasePublishableKey, supabaseUrl } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';
export async function GET() {
  if(!supabaseConfigured) return NextResponse.json({ok:false,configured:false},{status:503});
  const supabase=createClient(supabaseUrl,supabasePublishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {data,error}=await supabase.from('projects').select('id').limit(1);
  if(error) return NextResponse.json({ok:false,configured:true,error:error.code||'backend_error'},{status:503});
  return NextResponse.json({ok:true,configured:true,rlsAnonymousVisibleRows:data?.length??0});
}
