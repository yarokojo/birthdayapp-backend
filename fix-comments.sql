-- Add missing columns to comments table
ALTER TABLE comments ADD COLUMN IF NOT EXISTS user_name VARCHAR(255);
ALTER TABLE comments ADD COLUMN IF NOT EXISTS user_avatar TEXT;

-- Update existing comments with user info
UPDATE comments c 
SET user_name = u.name, 
    user_avatar = u.profile_image
FROM users u 
WHERE c.user_id = u.id 
AND (c.user_name IS NULL OR c.user_avatar IS NULL);

-- Verify the structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'comments'
ORDER BY ordinal_position;
