/*
  # Fix Registration and User Policies Final

  1. Changes
    - Simplify user policies to prevent recursion
    - Fix registration flow policies
    - Improve security model

  2. Security
    - Enable secure registration
    - Allow proper team management
    - Prevent policy recursion
*/

-- Drop existing policies
DROP POLICY IF EXISTS "users_read" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users_update" ON users;
DROP POLICY IF EXISTS "users_delete" ON users;

-- Basic read policy for authenticated users
CREATE POLICY "users_read_policy"
  ON users FOR SELECT
  TO authenticated
  USING (true);

-- Insert policy for registration and admin team management
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

-- Update policy for admin management
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

-- Delete policy for admin management
CREATE POLICY "users_delete_policy"
  ON users FOR DELETE
  TO authenticated
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM users admin
      WHERE admin.id = auth.uid()
      AND admin.role = 'admin'
    )
  );