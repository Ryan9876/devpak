import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generatePlanningProposal } from '@/lib/planning/ai';
import { loadProjectRoom } from '@/lib/room-model/repository';
import type { WorkspaceMode } from '@/lib/room-model/types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const ownerId = data?.claims?.sub;
  if (error || !ownerId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const mode = (body.mode || 'organize') as WorkspaceMode;
  const projectId = String(body.projectId || '');
  if (!['organize', 'arrange', 'build'].includes(mode)) return NextResponse.json({ error: 'Invalid mode.' }, { status: 400 });
  if (!UUID.test(projectId)) return NextResponse.json({ error: 'A valid project is required.' }, { status: 400 });

  const room = await loadProjectRoom(supabase, ownerId, projectId);
  if (!room) return NextResponse.json({ error: 'Room Model not found.' }, { status: 404 });

  const proposal = await generatePlanningProposal(room, mode, String(body.goal || ''));
  const { data: stored, error: persistError } = await supabase
    .from('planning_proposals')
    .insert({
      room_id: room.id,
      owner_id: ownerId,
      mode: proposal.mode,
      title: proposal.title,
      summary: proposal.summary,
      rationale: proposal.rationale,
      assumptions: proposal.assumptions,
      placements: proposal.placements,
      confidence: proposal.confidence,
      conflicts: proposal.conflicts,
      requires_verification: proposal.requiresVerification,
      status: 'proposed',
    })
    .select('id')
    .single();

  if (persistError || !stored) {
    return NextResponse.json({ error: 'The proposal could not be saved.' }, { status: 500 });
  }

  return NextResponse.json({ proposal: { ...proposal, id: stored.id } });
}
