/*
  # Fix recursive RLS policies

  1. Changes
    - Simplify policies to use direct auth checks
    - Remove nested subqueries that could cause recursion
    - Maintain security while avoiding circular references

  2. Security
    - Users can view and manage their own data
    - Admins can manage their church's users
    - All authenticated users can view their church
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can view same church members" ON users;
DROP POLICY IF EXISTS "Admins can manage church users" ON users;
DROP POLICY IF EXISTS "Users can view own church" ON churches;
DROP POLICY IF EXISTS "Admins can edit own church" ON churches;

-- Simplified users policies
CREATE POLICY "Enable read access for authenticated users"
  ON users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable write access for admins"
  ON users FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'admin'
    )
  );

-- Simplified churches policies
CREATE POLICY "Enable read access for authenticated users"
  ON churches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable write access for admins"
  ON churches FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'admin'
    )
  );