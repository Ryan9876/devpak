import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createProjectAction } from './actions';
import { listProjects } from '@/lib/room-model/repository';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (!configured) redirect('/studio');

  const supabase = await createClient();
  const { data: claimsData, error } = await supabase.auth.getClaims();
  const ownerId = claimsData?.claims?.sub;
  if (error || !ownerId) redirect('/login');

  const projects = await listProjects(supabase, ownerId);
  const query = await searchParams;

  return (
    <main className="projects-page">
      <section className="projects-heading">
        <div>
          <p className="eyebrow">YOUR ROOM MODELS</p>
          <h1>Projects</h1>
          <p>Each project owns its rooms, measurements, captures, objects, proposals and build plans.</p>
        </div>
        <form action="/auth/signout" method="post"><button className="small-button" type="submit">Sign out</button></form>
      </section>

      <section className="project-create panel">
        <div><h2>Create a project</h2><p>Start with one editable room. You can replace the starter dimensions as soon as you measure the space.</p></div>
        <form action={createProjectAction} className="project-create-form">
          <label>Project name<input name="name" maxLength={120} placeholder="Living room refresh" required /></label>
          <button className="button primary" type="submit">Create project</button>
        </form>
        {query.error === 'name-required' && <p className="auth-status">Enter a project name.</p>}
      </section>

      <section className="project-list" aria-label="Projects">
        {projects.length === 0 ? (
          <div className="empty-projects panel"><h2>No projects yet</h2><p>Create your first project above. Nothing is stored in the browser as the source of truth.</p></div>
        ) : projects.map((project) => (
          <Link className="project-card" key={project.id} href={`/projects/${project.id}/studio`}>
            <span className="project-card-kicker">ROOM MODEL</span>
            <h2>{project.name}</h2>
            <p>{project.defaultUnits === 'imperial' ? 'Imperial units' : 'Metric units'} · durable project</p>
            <span className="project-open">Open Studio →</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
