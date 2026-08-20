import { createServerClient } from '@supabase/ssr';
import { NextResponse,type NextRequest } from 'next/server';
import { supabasePublishableKey, supabaseUrl } from './config';

export async function updateSession(request:NextRequest){
  let response=NextResponse.next({request});
  const supabase=createServerClient(supabaseUrl,supabasePublishableKey,{cookies:{getAll:()=>request.cookies.getAll(),setAll(items,headers){items.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});items.forEach(({name,value,options})=>response.cookies.set(name,value,options));Object.entries(headers).forEach(([key,value])=>response.headers.set(key,value));}}});
  await supabase.auth.getClaims();
  return response;
}
