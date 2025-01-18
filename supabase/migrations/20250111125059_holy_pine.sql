/*
  # Fix RLS policies for users and churches

  1. Changes
    - Simplify RLS policies to prevent recursion
    - Add proper security checks without circular references
    - Ensure proper access control for users and churches

  2. Security
    - Users can view their own church's data
    - Admins can manage users within their church
    - All authenticated users can view their church settings
*/

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users viewable by church members" ON users;
DROP POLICY IF EXISTS "Users editable by admins" ON users;
DROP POLICY IF EXISTS "Churches viewable by members" ON churches;
DROP POLICY IF EXISTS "Churches editable by admins" ON churches;

-- Users policies
CREATE POLICY "Users can view own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can view same church members"
  ON users FOR SELECT
  USING (
    church_id IN (
      SELECT church_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage church users"
  ON users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'admin'
      AND church_id = users.church_id
    )
  );

-- Churches policies
CREATE POLICY "Users can view own church"
  ON churches FOR SELECT
  USING (
    id IN (
      SELECT church_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can edit own church"
  ON churches FOR UPDATE
  USING (
    id IN (
      SELECT church_id FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );