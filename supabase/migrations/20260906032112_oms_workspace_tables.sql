/*
# Office Management System — Workspace Tables

Creates tasks, events, messages, transactions, and notices tables.
All organization-scoped and owner-aware with RLS policies.
*/

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','review','done')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  due_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_org_tasks" ON tasks;
CREATE POLICY "select_org_tasks" ON tasks FOR SELECT
  TO authenticated USING (
    organization_id IS NULL OR
    EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = tasks.organization_id AND om.user_id = auth.uid()) OR
    public.is_super_admin()
  );

DROP POLICY IF EXISTS "insert_own_tasks" ON tasks;
CREATE POLICY "insert_own_tasks" ON tasks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_tasks" ON tasks;
CREATE POLICY "update_own_tasks" ON tasks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR public.is_super_admin()) WITH CHECK (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS "delete_own_tasks" ON tasks;
CREATE POLICY "delete_own_tasks" ON tasks FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR public.is_super_admin());

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  location text,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_org_events" ON events;
CREATE POLICY "select_org_events" ON events FOR SELECT
  TO authenticated USING (
    organization_id IS NULL OR
    EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = events.organization_id AND om.user_id = auth.uid()) OR
    public.is_super_admin()
  );

DROP POLICY IF EXISTS "insert_own_events" ON events;
CREATE POLICY "insert_own_events" ON events FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_events" ON events;
CREATE POLICY "update_own_events" ON events FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR public.is_super_admin()) WITH CHECK (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS "delete_own_events" ON events;
CREATE POLICY "delete_own_events" ON events FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR public.is_super_admin());

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_messages" ON messages;
CREATE POLICY "select_own_messages" ON messages FOR SELECT
  TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id OR public.is_super_admin());

DROP POLICY IF EXISTS "insert_own_messages" ON messages;
CREATE POLICY "insert_own_messages" ON messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "update_own_messages" ON messages;
CREATE POLICY "update_own_messages" ON messages FOR UPDATE
  TO authenticated USING (auth.uid() = receiver_id OR public.is_super_admin()) WITH CHECK (auth.uid() = receiver_id OR public.is_super_admin());

DROP POLICY IF EXISTS "delete_own_messages" ON messages;
CREATE POLICY "delete_own_messages" ON messages FOR DELETE
  TO authenticated USING (auth.uid() = sender_id OR public.is_super_admin());

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'expense' CHECK (type IN ('income','expense')),
  category text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_org_transactions" ON transactions;
CREATE POLICY "select_org_transactions" ON transactions FOR SELECT
  TO authenticated USING (
    organization_id IS NULL OR
    EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = transactions.organization_id AND om.user_id = auth.uid()) OR
    public.is_super_admin()
  );

DROP POLICY IF EXISTS "insert_own_transactions" ON transactions;
CREATE POLICY "insert_own_transactions" ON transactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_transactions" ON transactions;
CREATE POLICY "update_own_transactions" ON transactions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR public.is_super_admin()) WITH CHECK (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS "delete_own_transactions" ON transactions;
CREATE POLICY "delete_own_transactions" ON transactions FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR public.is_super_admin());

CREATE TABLE IF NOT EXISTS notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','important','urgent')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_org_notices" ON notices;
CREATE POLICY "select_org_notices" ON notices FOR SELECT
  TO authenticated USING (
    organization_id IS NULL OR
    EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = notices.organization_id AND om.user_id = auth.uid()) OR
    public.is_super_admin()
  );

DROP POLICY IF EXISTS "insert_own_notices" ON notices;
CREATE POLICY "insert_own_notices" ON notices FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS "delete_own_notices" ON notices;
CREATE POLICY "delete_own_notices" ON notices FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR public.is_super_admin());

CREATE INDEX IF NOT EXISTS idx_tasks_org_user ON tasks(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_events_org_start ON events(organization_id, start_time);
CREATE INDEX IF NOT EXISTS idx_messages_parties ON messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_transactions_org ON transactions(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notices_org ON notices(organization_id, created_at);
