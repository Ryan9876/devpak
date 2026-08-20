import { readFileSync } from 'node:fs';
const sql=readFileSync('supabase/migrations/202608200001_phase2_room_model.sql','utf8');
const required=['projects','rooms','room_measurements','room_objects','room_openings','planning_proposals','build_plans','room_assets'];
const missing=required.filter((name)=>!sql.includes(`public.${name}`));
const rls=(sql.match(/enable row level security/g)||[]).length;
const policies=(sql.match(/create policy/g)||[]).length;
console.log('NESTMETRIC_PHASE2_SCHEMA_GATE',{tables:required.length,missing,rls,policies,storageBucket:sql.includes("'room-assets'")});
if(missing.length||rls<required.length||policies<required.length)process.exit(1);
