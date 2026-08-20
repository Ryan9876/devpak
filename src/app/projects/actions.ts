'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createProjectWithStarterRoom } from '@/lib/room-model/repository';
import { createClient } from '@/lib/supabase/server';

export async function createProjectAction(formData: FormData) {
  const supabase = await createClient();
  const { data: claimsData, error } = await supabase.auth.getClaims();
  const ownerId = claimsData?.claims?.sub;
  if (error || !ownerId) redirect('/login');

  const name = String(formData.get('name') ?? '').trim();
  if (!name) redirect('/projects?error=name-required');

  const { projectId } = await createProjectWithStarterRoom(supabase, ownerId, name);
  revalidatePath('/projects');
  redirect(`/projects/${projectId}/studio`);
}
