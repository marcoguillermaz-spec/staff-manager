-- ============================================================
-- Staff Manager — Migration 006: Tickets Storage
-- ============================================================
-- Private `tickets` bucket for message attachments.
-- Upload/download exclusively via service role in API routes
-- (same pattern as `compensations`, `expenses`, `documents` buckets).
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tickets',
  'tickets',
  false,
  10485760,   -- 10 MB
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

-- Service role (used in API routes) bypasses RLS on storage — no additional
-- storage policy is needed. Authenticated users must NOT access this bucket
-- directly; all file operations go through the API routes.
