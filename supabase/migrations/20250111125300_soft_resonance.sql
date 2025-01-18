/*
  # Fix Church RLS Policies

  1. Changes
    - Add INSERT policy for churches table
    - Simplify policy names to avoid duplicates
    - Add policy for initial church creation

  2. Security
    - Allow authenticated users to create their first church
    - Maintain existing read/write permissions
*/

-- Drop existing policies with duplicate names
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON churches;
DROP POLICY IF EXISTS "Enable write access for admins" ON churches;

-- Churches policies
CREATE POLICY "churches_read"
  ON churches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "churches_insert"
  ON churches FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.church_id IS NOT NULL
    )
  );

CREATE POLICY "churches_update"
  ON churches FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'admin'
    )
  );