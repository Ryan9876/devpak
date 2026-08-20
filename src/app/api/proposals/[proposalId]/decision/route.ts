import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DECISIONS = new Set(['accepted', 'rejected', 'edited']);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ proposalId: string }> },
) {
  const { proposalId } = await params;
  if (!UUID.test(proposalId)) return NextResponse.json({ error: 'Invalid proposal.' }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const ownerId = data?.claims?.sub;
  if (error || !ownerId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const status = String(body.status || '');
  if (!DECISIONS.has(status)) return NextResponse.json({ error: 'Invalid proposal decision.' }, { status: 400 });

  const { data: updated, error: updateError } = await supabase
    .from('planning_proposals')
    .update({ status, decided_at: new Date().toISOString() })
    .eq('id', proposalId)
    .eq('owner_id', ownerId)
    .select('id,status')
    .maybeSingle();

  if (updateError) return NextResponse.json({ error: 'The proposal decision could not be saved.' }, { status: 500 });
  if (!updated) return NextResponse.json({ error: 'Proposal not found.' }, { status: 404 });

  return NextResponse.json({ ok: true, proposal: updated });
}
