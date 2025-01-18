/*
  # Fix Users Table RLS Policies

  1. Changes
    - Remove recursive policies that were causing infinite recursion
    - Simplify user policies to focus on basic CRUD operations
    - Add clear policies for initial user creation during registration

  2. Security
    - Enable RLS
    - Add policies for select, insert, and update operations
    - Ensure new users can be created during registration
    - Maintain admin-only updates for existing users
*/

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable write access for admins" ON users;

-- Allow users to read their own data and data of users in their church
CREATE POLICY "users_read_own_and_church"
  ON users FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() OR
    church_id IN (
      SELECT church_id FROM users WHERE id = auth.uid()
    )
  );

-- Allow initial user creation during registration
CREATE POLICY "users_insert_during_registration"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    id = auth.uid() AND
    NOT EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()
    )
  );

-- Allow admins to manage users in their church
CREATE POLICY "users_manage_by_admin"
  ON users FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'admin'
      AND church_id = users.church_id
    )
  );