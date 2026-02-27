-- Rename ha_figli_a_carico → sono_un_figlio_a_carico
-- Semantic correction: the collaborator declares they ARE fiscally dependent (not that they HAVE dependents)

ALTER TABLE collaborators
  RENAME COLUMN ha_figli_a_carico TO sono_un_figlio_a_carico;
