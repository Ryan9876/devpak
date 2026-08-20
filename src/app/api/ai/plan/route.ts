import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generatePlanningProposal } from '@/lib/planning/ai';
import { loadFirstRoom } from '@/lib/room-model/repository';
import type { WorkspaceMode } from '@/lib/room-model/types';

export async function POST(request:Request){
  const supabase=await createClient();const {data,error}=await supabase.auth.getClaims();const ownerId=data?.claims?.sub;if(error||!ownerId)return NextResponse.json({error:'Authentication required.'},{status:401});
  const body=await request.json().catch(()=>({}));const mode=(body.mode||'organize') as WorkspaceMode;if(!['organize','arrange','build'].includes(mode))return NextResponse.json({error:'Invalid mode.'},{status:400});
  const room=await loadFirstRoom(supabase,ownerId);if(!room)return NextResponse.json({error:'Room Model not found.'},{status:404});
  const proposal=await generatePlanningProposal(room,mode,String(body.goal||''));
  return NextResponse.json({proposal});
}
