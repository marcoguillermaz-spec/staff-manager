-- Block 6: make expense descrizione optional
-- Previously NOT NULL; collaborators can now submit without a description.
ALTER TABLE expense_reimbursements
  ALTER COLUMN descrizione DROP NOT NULL;
