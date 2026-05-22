-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instagram_user_id TEXT UNIQUE NOT NULL,
    username TEXT,
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    total_comments INT DEFAULT 0,
    total_dms_sent INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_users_ig_user_id ON users(instagram_user_id);

-- Table: reels
CREATE TABLE IF NOT EXISTS reels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instagram_media_id TEXT UNIQUE NOT NULL,
    caption TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_reels_ig_media_id ON reels(instagram_media_id);

-- Table: templates (Smart Reply System)
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword TEXT UNIQUE NOT NULL,
    message_template TEXT NOT NULL,
    whatsapp_link TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_templates_keyword ON templates(keyword);

-- Insert Default Templates
INSERT INTO templates (keyword, message_template, whatsapp_link) VALUES 
('pdf', 'Hello! Here is the Document Verification PDF you requested. Let us know if you need help!', 'https://wa.me/1234567890?text=PDF_REEL'),
('college', 'Hey! Use our College Predictor tool here: https://example.com/predictor', 'https://wa.me/1234567890?text=COLLEGE_PREDICTOR'),
('guide', 'Hi there! Grab your complete CAP Guide here: https://example.com/guide', 'https://wa.me/1234567890?text=CAP_GUIDE'),
('link', 'Hello! Join our WhatsApp Community using this link: https://chat.whatsapp.com/example', 'https://wa.me/1234567890?text=COMMUNITY_LINK')
ON CONFLICT (keyword) DO NOTHING;

-- Table: comments
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reel_id UUID REFERENCES reels(id) ON DELETE SET NULL,
    comment_text TEXT,
    keyword_detected TEXT REFERENCES templates(keyword) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_reel_id ON comments(reel_id);
CREATE INDEX IF NOT EXISTS idx_comments_keyword ON comments(keyword_detected);

-- Table: dm_logs
CREATE TABLE IF NOT EXISTS dm_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    comment_id TEXT REFERENCES comments(comment_id) ON DELETE CASCADE,
    message_sent TEXT,
    status TEXT NOT NULL, -- 'SUCCESS', 'FAILED', 'SKIPPED'
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_dm_logs_user_status ON dm_logs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_dm_logs_created_at ON dm_logs(created_at);

-- Table: broadcast_logs
CREATE TABLE IF NOT EXISTS broadcast_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment TEXT NOT NULL,
    message_text TEXT NOT NULL,
    total_targeted INT DEFAULT 0,
    total_sent INT DEFAULT 0,
    status TEXT DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Table: keyword_stats (can be a view for real-time calculation)
CREATE OR REPLACE VIEW keyword_stats AS
SELECT 
    keyword_detected as keyword, 
    COUNT(*) as count
FROM comments
WHERE keyword_detected IS NOT NULL
GROUP BY keyword_detected;

-- RPC Function to increment user stats atomically
CREATE OR REPLACE FUNCTION increment_user_stats(user_uuid UUID)
RETURNS void AS $$
BEGIN
    UPDATE users 
    SET total_comments = total_comments + 1,
        total_dms_sent = total_dms_sent + 1
    WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql;
