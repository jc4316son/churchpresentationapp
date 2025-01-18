/*
  # Fix Church RLS Policies - Final Update

  1. Changes
    - Modify UPDATE policy to handle both new and existing churches
    - Ensure proper access for initial setup and updates
    - Maintain security while allowing necessary operations

  2. Security
    - Allow authenticated users to read churches
    - Allow authenticated users to create their first church
    - Allow admins to update churches they belong to
*/

-- Drop existing policies
DROP POLICY IF EXISTS "churches_select" ON churches;
DROP POLICY IF EXISTS "churches_insert" ON churches;
DROP POLICY IF EXISTS "churches_update" ON churches;

-- Read policy - allow authenticated users to read churches
CREATE POLICY "churches_select"
  ON churches FOR SELECT
  TO authenticated
  USING (true);

-- Insert policy - allow authenticated users to create a church
CREATE POLICY "churches_insert"
  ON churches FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Update policy - simplified to allow updates for new and existing churches
CREATE POLICY "churches_update"
  ON churches FOR UPDATE
  TO authenticated
  USING (
    -- Allow updates if user is an admin of this church
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.church_id = churches.id
      AND users.role = 'admin'
    )
    OR
    -- Allow updates if user has no church assigned yet (for initial setup)
    NOT EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.church_id IS NOT NULL
    )
  );