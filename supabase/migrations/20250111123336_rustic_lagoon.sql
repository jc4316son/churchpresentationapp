/*
  # Initial Schema for Church Presentation App

  1. New Tables
    - churches
      - Organization details and settings
    - users
      - User accounts with role-based access
    - songs
      - Song library
    - song_segments
      - Individual segments of songs (verses, choruses, etc.)

  2. Security
    - Enable RLS on all tables
    - Add policies for proper access control
*/

-- Churches table
CREATE TABLE churches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  theme jsonb DEFAULT '{"primary_color": "#4F46E5", "secondary_color": "#818CF8"}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE churches ENABLE ROW LEVEL SECURITY;

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users,
  email text NOT NULL,
  church_id uuid REFERENCES churches,
  role text NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Songs table
CREATE TABLE songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text NOT NULL,
  church_id uuid REFERENCES churches NOT NULL,
  created_by uuid REFERENCES users NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE songs ENABLE ROW LEVEL SECURITY;

-- Song segments table
CREATE TABLE song_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid REFERENCES songs ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('verse', 'chorus', 'bridge', 'pre-chorus')),
  order_num integer NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE song_segments ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Churches: viewable by all members, editable by admins
CREATE POLICY "Churches viewable by members" ON churches
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM users WHERE church_id = churches.id
    )
  );

CREATE POLICY "Churches editable by admins" ON churches
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM users WHERE church_id = churches.id AND role = 'admin'
    )
  );

-- Users: viewable by church members, editable by admins
CREATE POLICY "Users viewable by church members" ON users
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM users WHERE church_id = users.church_id
    )
  );

CREATE POLICY "Users editable by admins" ON users
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM users WHERE church_id = users.church_id AND role = 'admin'
    )
  );

-- Songs: viewable by church members, editable by editors and admins
CREATE POLICY "Songs viewable by church members" ON songs
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM users WHERE church_id = songs.church_id
    )
  );

CREATE POLICY "Songs editable by editors and admins" ON songs
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM users WHERE 
        church_id = songs.church_id 
        AND role IN ('editor', 'admin')
    )
  );

-- Song segments: same permissions as songs
CREATE POLICY "Song segments viewable by church members" ON song_segments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM songs 
      WHERE songs.id = song_segments.song_id
      AND auth.uid() IN (
        SELECT id FROM users WHERE church_id = songs.church_id
      )
    )
  );

CREATE POLICY "Song segments editable by editors and admins" ON song_segments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM songs 
      WHERE songs.id = song_segments.song_id
      AND auth.uid() IN (
        SELECT id FROM users 
        WHERE church_id = songs.church_id 
        AND role IN ('editor', 'admin')
      )
    )
  );

-- Functions

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for songs table
CREATE TRIGGER update_songs_updated_at
  BEFORE UPDATE ON songs
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();