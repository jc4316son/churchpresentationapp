/*
  # Recreate Missing Tables

  1. Tables
    - Ensures all required tables exist:
      - churches
      - users
      - songs
      - song_segments

  2. Security
    - Enables RLS on all tables
    - Adds necessary policies for each table

  Note: Uses IF NOT EXISTS to prevent conflicts with existing tables
*/

-- Churches table
CREATE TABLE IF NOT EXISTS churches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  theme jsonb DEFAULT '{"primary_color": "#4F46E5", "secondary_color": "#818CF8"}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users,
  email text NOT NULL,
  church_id uuid REFERENCES churches,
  role text NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  created_at timestamptz DEFAULT now()
);

-- Songs table
CREATE TABLE IF NOT EXISTS songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text NOT NULL,
  church_id uuid REFERENCES churches NOT NULL,
  created_by uuid REFERENCES users NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Song segments table
CREATE TABLE IF NOT EXISTS song_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid REFERENCES songs ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('verse', 'chorus', 'bridge', 'pre-chorus')),
  order_num integer NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_segments ENABLE ROW LEVEL SECURITY;

-- Recreate policies if they don't exist

-- Churches policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'churches' AND policyname = 'churches_select'
  ) THEN
    CREATE POLICY "churches_select"
      ON churches FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'churches' AND policyname = 'churches_insert'
  ) THEN
    CREATE POLICY "churches_insert"
      ON churches FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'churches' AND policyname = 'churches_update'
  ) THEN
    CREATE POLICY "churches_update"
      ON churches FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.church_id = churches.id
          AND users.role = 'admin'
        )
        OR
        NOT EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.church_id IS NOT NULL
        )
      );
  END IF;
END $$;

-- Users policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'users_read_policy'
  ) THEN
    CREATE POLICY "users_read_policy"
      ON users FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'users_insert_policy'
  ) THEN
    CREATE POLICY "users_insert_policy"
      ON users FOR INSERT
      TO authenticated
      WITH CHECK (
        auth.uid() IS NOT NULL AND (
          id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM users admin
            WHERE admin.id = auth.uid()
            AND admin.role = 'admin'
          )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'users_update_policy'
  ) THEN
    CREATE POLICY "users_update_policy"
      ON users FOR UPDATE
      TO authenticated
      USING (
        auth.uid() IS NOT NULL AND
        EXISTS (
          SELECT 1 FROM users admin
          WHERE admin.id = auth.uid()
          AND admin.role = 'admin'
        )
      );
  END IF;
END $$;

-- Songs policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'songs' AND policyname = 'songs_read_policy'
  ) THEN
    CREATE POLICY "songs_read_policy"
      ON songs FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.church_id = songs.church_id
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'songs' AND policyname = 'songs_write_policy'
  ) THEN
    CREATE POLICY "songs_write_policy"
      ON songs FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.church_id = songs.church_id
          AND users.role IN ('admin', 'editor')
        )
      );
  END IF;
END $$;

-- Song segments policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'song_segments' AND policyname = 'song_segments_read_policy'
  ) THEN
    CREATE POLICY "song_segments_read_policy"
      ON song_segments FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM songs
          JOIN users ON users.church_id = songs.church_id
          WHERE songs.id = song_segments.song_id
          AND users.id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'song_segments' AND policyname = 'song_segments_write_policy'
  ) THEN
    CREATE POLICY "song_segments_write_policy"
      ON song_segments FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM songs
          JOIN users ON users.church_id = songs.church_id
          WHERE songs.id = song_segments.song_id
          AND users.id = auth.uid()
          AND users.role IN ('admin', 'editor')
        )
      );
  END IF;
END $$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Recreate trigger if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_songs_updated_at'
  ) THEN
    CREATE TRIGGER update_songs_updated_at
      BEFORE UPDATE ON songs
      FOR EACH ROW
      EXECUTE PROCEDURE update_updated_at_column();
  END IF;
END $$;