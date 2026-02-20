-- ============================================================
-- Staff Manager — Migration 004: Documents Storage bucket + policies
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Create private 'documents' bucket ───────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760,
        array['application/pdf','image/jpeg','image/png','image/jpg'])
on conflict (id) do nothing;

-- ── Storage policies on storage.objects ──────────────────────

-- Admin can upload to documents bucket
create policy "documents_admin_upload"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and auth.role() = 'authenticated'
    and (select role from user_profiles where user_id = auth.uid())
        in ('amministrazione', 'super_admin')
  );

-- Collaboratore can upload signed files to their own folder
-- Path format: {userId}/{documentId}/firmato_{filename}
create policy "documents_collab_upload_signed"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (select role from user_profiles where user_id = auth.uid()) = 'collaboratore'
  );

-- Admin can read all documents
create policy "documents_admin_read"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and (select role from user_profiles where user_id = auth.uid())
        in ('amministrazione', 'super_admin')
  );

-- Collaboratore can read files in their own folder
create policy "documents_collab_read"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admin can delete documents
create policy "documents_admin_delete"
  on storage.objects for delete
  using (
    bucket_id = 'documents'
    and (select role from user_profiles where user_id = auth.uid())
        in ('amministrazione', 'super_admin')
  );
