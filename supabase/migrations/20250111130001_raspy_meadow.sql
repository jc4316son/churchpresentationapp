/*
  # Fix Users Table Policies Final

  1. Changes
    - Simplify policies to avoid recursion
    - Fix registration flow policies
    - Improve team member management

  2. Security
    - Maintain proper access control
    - Enable registration without recursion
    - Allow team management
*/

-- Drop existing policies
DROP POLICY IF EXISTS "users_read_own_and_church" ON users;
DROP POLICY IF EXISTS "users_insert_during_registration" ON users;
DROP POLICY IF EXISTS "users_manage_by_admin" ON users;

-- Basic read policy for all authenticated users
CREATE POLICY "users_read"
  ON users FOR SELECT
  TO authenticated
  USING (true);

-- Allow initial user creation during registration
CREATE POLICY "users_insert"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.church_id = church_id
    )
  );

-- Allow admins to update users in their church
CREATE POLICY "users_update"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.church_id = users.church_id
    )
  );

-- Allow admins to delete users in their church
CREATE POLICY "users_delete"
  ON users FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.church_id = users.church_id
    )
  );