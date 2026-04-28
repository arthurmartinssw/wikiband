ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS username VARCHAR(32);

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_username_unique_idx
ON usuarios (username)
WHERE username IS NOT NULL;
