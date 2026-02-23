-- Migration 011: add provincia_nascita, provincia_residenza, civico_residenza
-- Required for Cococo contract template field mapping

ALTER TABLE collaborators
  ADD COLUMN IF NOT EXISTS provincia_nascita   text,
  ADD COLUMN IF NOT EXISTS provincia_residenza text,
  ADD COLUMN IF NOT EXISTS civico_residenza    text;
