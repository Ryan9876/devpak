import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export async function GET() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key) return NextResponse.json({ok:false,configured:false},{status:503});
  const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {data,error}=await supabase.from('projects').select('id').limit(1);
  if(error) return NextResponse.json({ok:false,configured:true,error:error.code||'backend_error'},{status:503});
  return NextResponse.json({ok:true,configured:true,rlsAnonymousVisibleRows:data?.length??0});
}
