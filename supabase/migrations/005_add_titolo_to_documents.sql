-- ============================================================
-- Staff Manager — Migration 005: Add titolo column to documents
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- Add titolo column (free-text title set by admin when uploading)
alter table documents add column if not exists titolo text not null default '';

-- Back-fill existing rows with a derived title
update documents
   set titolo = tipo || case when anno is not null then ' ' || anno::text else '' end
 where titolo = '';
