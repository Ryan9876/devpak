import type { SupabaseClient } from '@supabase/supabase-js';
import type { RoomModel } from './types';

export async function loadFirstRoom(supabase: SupabaseClient, ownerId: string): Promise<RoomModel | null> {
  const { data: room, error } = await supabase.from('rooms').select('*').eq('owner_id', ownerId).order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!room) return null;
  const [m, o, op] = await Promise.all([
    supabase.from('room_measurements').select('*').eq('room_id', room.id).order('created_at'),
    supabase.from('room_objects').select('*').eq('room_id', room.id).order('created_at'),
    supabase.from('room_openings').select('*').eq('room_id', room.id).order('created_at'),
  ]);
  for (const result of [m,o,op]) if (result.error) throw result.error;
  return {
    schemaVersion: 2,
    id: room.id,
    projectId: room.project_id,
    name: room.name,
    units: room.units,
    boundary: { widthUm: Number(room.width_um), depthUm: Number(room.depth_um), ceilingHeightUm: room.ceiling_height_um == null ? null : Number(room.ceiling_height_um) },
    measurements: (m.data ?? []).map((x:any)=>({ id:x.id,label:x.label,valueUm:Number(x.value_um),toleranceUm:Number(x.tolerance_um),confidence:Number(x.confidence),source:x.source,verification:x.verification,deviceContext:x.device_context,calibration:x.calibration,correctionHistory:x.correction_history ?? [] })),
    objects: (o.data ?? []).map((x:any)=>({ id:x.id,label:x.label,kind:x.kind,position:{xUm:Number(x.x_um),yUm:Number(x.y_um)},size:{widthUm:Number(x.width_um),depthUm:Number(x.depth_um)},rotationDeg:Number(x.rotation_deg),fixed:x.fixed,clearanceUm:Number(x.clearance_um),source:x.source,confidence:x.confidence==null?null:Number(x.confidence),notes:x.notes })),
    openings: (op.data ?? []).map((x:any)=>({ id:x.id,wall:x.wall,offsetUm:Number(x.offset_um),widthUm:Number(x.width_um),kind:x.kind,swing:x.swing })),
    assumptions: room.assumptions ?? [],
    updatedAt: room.updated_at,
  };
}

export async function createStarterRoom(supabase: SupabaseClient, ownerId: string) {
  const { data: project, error: pe } = await supabase.from('projects').insert({ owner_id: ownerId, name: 'My room', default_units: 'imperial' }).select().single();
  if (pe) throw pe;
  const { data: room, error: re } = await supabase.from('rooms').insert({ project_id: project.id, owner_id: ownerId, name: 'Main room', width_um: 3_657_600, depth_um: 3_048_000, units: 'imperial', assumptions: ['Initial dimensions are examples until you replace or verify them.'] }).select().single();
  if (re) throw re;
  const objects = [
    { room_id:room.id,owner_id:ownerId,label:'Sofa',kind:'furniture',x_um:300_000,y_um:300_000,width_um:1_900_000,depth_um:850_000,rotation_deg:0,fixed:false,clearance_um:100_000,source:'system' },
    { room_id:room.id,owner_id:ownerId,label:'Coffee table',kind:'furniture',x_um:1_150_000,y_um:1_450_000,width_um:1_000_000,depth_um:550_000,rotation_deg:0,fixed:false,clearance_um:80_000,source:'system' },
    { room_id:room.id,owner_id:ownerId,label:'Built-in',kind:'fixture',x_um:2_900_000,y_um:250_000,width_um:450_000,depth_um:1_300_000,rotation_deg:0,fixed:true,clearance_um:50_000,source:'system' },
  ];
  const { error: oe } = await supabase.from('room_objects').insert(objects); if (oe) throw oe;
  const { error: op } = await supabase.from('room_openings').insert({ room_id:room.id,owner_id:ownerId,wall:'south',offset_um:1_000_000,width_um:900_000,kind:'door',swing:'in' }); if (op) throw op;
  return room.id;
}
