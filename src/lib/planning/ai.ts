import type { PlanningProposal, RoomModel, WorkspaceMode } from '../room-model/types';
import { deterministicProposal } from './deterministic';
import { validatePlacement } from '../room-model/geometry';

export async function generatePlanningProposal(room: RoomModel, mode: WorkspaceMode, goal: string): Promise<PlanningProposal> {
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey) return deterministicProposal(room,mode);
  const payload={mode,goal,room:{boundary:room.boundary,objects:room.objects,openings:room.openings,measurements:room.measurements.map(m=>({label:m.label,valueUm:m.valueUm,toleranceUm:m.toleranceUm,confidence:m.confidence,source:m.source,verification:m.verification})),assumptions:room.assumptions}};
  try{
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5.6-sol',input:[{role:'system',content:'Return ONLY JSON with title, summary, rationale[], assumptions[], placements[{objectId,position:{xUm,yUm},rotationDeg}], confidence, requiresVerification[]. Do not invent room geometry.'},{role:'user',content:JSON.stringify(payload)}]})});
    if(!response.ok) throw new Error(`AI ${response.status}`);const json:any=await response.json();const text=json.output_text??json.output?.flatMap((o:any)=>o.content??[]).find((c:any)=>c.type==='output_text')?.text;const raw=JSON.parse(text);const proposal:PlanningProposal={id:crypto.randomUUID(),mode,title:String(raw.title||'Proposal'),summary:String(raw.summary||''),rationale:Array.isArray(raw.rationale)?raw.rationale.map(String):[],assumptions:Array.isArray(raw.assumptions)?raw.assumptions.map(String):[],placements:Array.isArray(raw.placements)?raw.placements:[],confidence:Math.max(0,Math.min(1,Number(raw.confidence)||.5)),requiresVerification:Array.isArray(raw.requiresVerification)?raw.requiresVerification.map(String):[],conflicts:[]};proposal.conflicts=proposal.placements.flatMap(p=>{const base=room.objects.find(o=>o.id===p.objectId);return base?validatePlacement(room,{...base,position:p.position,rotationDeg:p.rotationDeg}):[`Unknown object ${p.objectId}.`]});return proposal;
  }catch{return deterministicProposal(room,mode);}
}
