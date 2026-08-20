import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadProjectRoom } from '@/lib/room-model/repository';
import { BuildEvidenceError, generateBuildPlan, type BuildKind, type BuildMaterialPreference } from '@/lib/builds/generate';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KINDS = new Set<BuildKind>(['shelving', 'storage', 'desk', 'cabinet']);
const MATERIALS = new Set<BuildMaterialPreference>(['plywood', 'solid-wood', 'melamine']);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const ownerId = claimsData?.claims?.sub;
  if (claimsError || !ownerId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const projectId = String(body.projectId || '');
  const kind = String(body.kind || '') as BuildKind;
  const material = String(body.material || '') as BuildMaterialPreference;
  if (!UUID.test(projectId)) return NextResponse.json({ error: 'A valid project is required.' }, { status: 400 });
  if (!KINDS.has(kind)) return NextResponse.json({ error: 'Choose a supported build type.' }, { status: 400 });
  if (!MATERIALS.has(material)) return NextResponse.json({ error: 'Choose a supported material.' }, { status: 400 });

  const room = await loadProjectRoom(supabase, ownerId, projectId);
  if (!room) return NextResponse.json({ error: 'Room Model not found.' }, { status: 404 });

  try {
    const plan = generateBuildPlan(room, {
      kind,
      material,
      title: String(body.title || ''),
      widthUm: Math.round(Number(body.widthMm) * 1000),
      heightUm: Math.round(Number(body.heightMm) * 1000),
      depthUm: Math.round(Number(body.depthMm) * 1000),
    });

    const { data: stored, error: saveError } = await supabase
      .from('build_plans')
      .insert({
        room_id: room.id,
        owner_id: ownerId,
        title: plan.title,
        geometry: {
          status: plan.status,
          kind: plan.kind,
          overall: plan.overall,
          placement: plan.placement,
          clearances: plan.clearances,
          components: plan.components,
          conflicts: plan.conflicts,
        },
        materials: plan.materials,
        assumptions: plan.assumptions,
        verification_snapshot: plan.verification,
        cost_estimate: plan.costEstimate,
        effort_estimate: plan.effortEstimate,
      })
      .select('id,created_at')
      .single();

    if (saveError || !stored) return NextResponse.json({ error: 'The build plan could not be saved.' }, { status: 500 });
    return NextResponse.json({ plan: { id: stored.id, createdAt: stored.created_at, ...plan } });
  } catch (error) {
    if (error instanceof BuildEvidenceError) {
      return NextResponse.json({ error: error.message, missing: error.missing, unverified: error.unverified }, { status: 422 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Build plan generation failed.' }, { status: 400 });
  }
}
