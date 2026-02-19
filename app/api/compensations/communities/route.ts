import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/compensations/communities
 * Returns the communities the current collaboratore belongs to.
 * Used by the CompensationWizard to populate the community selector.
 */
export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: col } = await supabase
    .from('collaborators')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!col) return NextResponse.json({ communities: [] });

  const { data, error } = await supabase
    .from('collaborator_communities')
    .select('communities(id, name)')
    .eq('collaborator_id', col.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type CommunityRow = { id: string; name: string };
  const communities = (data ?? [])
    .map((row) => (row.communities as unknown as CommunityRow | null))
    .filter((c): c is CommunityRow => c !== null);

  return NextResponse.json({ communities });
}
