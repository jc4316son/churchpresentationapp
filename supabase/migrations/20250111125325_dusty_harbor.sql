/*
  # Fix Church RLS Policies - Final Update

  1. Changes
    - Simplify church policies to fix access issues
    - Add proper INSERT and UPDATE policies
    - Ensure proper access control for church management

  2. Security
    - Allow authenticated users to create their first church
    - Allow admins to update their church
    - Allow all authenticated users to read churches
*/

-- Drop existing policies
DROP POLICY IF EXISTS "churches_read" ON churches;
DROP POLICY IF EXISTS "churches_insert" ON churches;
DROP POLICY IF EXISTS "churches_update" ON churches;

-- Read policy - allow authenticated users to read any church
CREATE POLICY "churches_select"
  ON churches FOR SELECT
  TO authenticated
  USING (true);

-- Insert policy - allow authenticated users to create a church
CREATE POLICY "churches_insert"
  ON churches FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Update policy - allow admins to update their church
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
  )
  WITH CHECK (true);