-- Add importo_lordo_massimale: collaborator-editable annual gross income cap
-- Nullable: NULL = no cap set, progress bar not shown
-- Max value enforced at application layer (5000 EUR)

ALTER TABLE collaborators
  ADD COLUMN importo_lordo_massimale decimal(10, 2) NULL;
