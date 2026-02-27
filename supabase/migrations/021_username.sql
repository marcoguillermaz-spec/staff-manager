-- Block 4: add username column to collaborators
ALTER TABLE collaborators ADD COLUMN username TEXT UNIQUE;
