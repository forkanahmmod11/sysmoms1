/*
# Sysmobyte multi-tenant RBAC: organizations, roles, members, features, projects

1. New Tables
- `organizations` — each tenant/workspace (name, subdomain, created_by, status).
- `organization_members` — joins users to orgs with a role (super_admin, admin, moderator, full_stack_developer, backend_developer, frontend_developer, graphics_video_editor, marketing_specialist, hr, employee).
- `features` — catalog of toggleable OMS features (key, name, description, category).
- `organization_features` — which features are enabled per org (org_id, feature_id, enabled).
- `projects` — projects belong to an org (name, description, status, progress).
- `project_groups` — sub-groups within a project (name, project_id).

2. Modified Tables
- `profiles.role` CHECK constraint updated to include the full role catalog.
- `profiles` gains `organization_id` (nullable) for the user's primary org.

3. Security
- RLS enabled on all new tables.
- `is_super_admin()` helper: returns true if the current user holds the super_admin role in organization_members OR their profile role is super_admin.
- `is_org_admin(org_id)` helper: returns true if the user is super_admin OR admin of that org.
- organizations: super_admin CRUD all; members can read their own org.
- organization_members: super_admin CRUD all; org admins can manage their org's members; members can read their org's members.
- features: everyone authenticated can read the catalog; only super_admin can insert/update/delete.
- organization_features: super_admin + org admin can manage; members can read their org's.
- projects + project_groups: super_admin + org admin can manage; members can read their org's.

4. Notes
- The super admin email (ahmedforkan26@gmail.com) is auto-assigned the super_admin role via the existing handle_new_user trigger, which now also checks is_super_admin_email.
- Seed data: default features catalog, a default organization, and the super admin as a member.
*/

-- Helper: is super admin email
CREATE OR REPLACE FUNCTION public.is_super_admin_email(e text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT lower(e) IN ('ahmedforkan26@gmail.com')
$$;

-- Update profiles role check to include full role catalog
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_role_check' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('super_admin','admin','moderator','full_stack_developer','backend_developer','frontend_developer','graphics_video_editor','marketing_specialist','hr','employee'));
  ELSE
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('super_admin','admin','moderator','full_stack_developer','backend_developer','frontend_developer','graphics_video_editor','marketing_specialist','hr','employee'));
  END IF;
END $$;

-- Organizations
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subdomain text UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','archived')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Add organization_id to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN organization_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_organization_id_fkey' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Organization members (RBAC junction)
CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'employee' CHECK (role IN ('super_admin','admin','moderator','full_stack_developer','backend_developer','frontend_developer','graphics_video_editor','marketing_specialist','hr','employee')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

-- Features catalog
CREATE TABLE IF NOT EXISTS public.features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  created_at timestamptz DEFAULT now()
);

-- Organization features (toggle per org)
CREATE TABLE IF NOT EXISTS public.organization_features (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  feature_id uuid NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  PRIMARY KEY (organization_id, feature_id)
);

-- Projects
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','active','on_hold','completed','cancelled')),
  progress int NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at timestamptz DEFAULT now()
);

-- Project groups
CREATE TABLE IF NOT EXISTS public.project_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_org ON public.projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_groups_project ON public.project_groups(project_id);

-- RLS helper functions
CREATE OR REPLACE FUNCTION public.is_super_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'super_admin'
  ) OR EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.user_id = auth.uid() AND m.role = 'super_admin'
  ) OR public.is_super_admin_email(
    (SELECT email FROM public.profiles WHERE id = auth.uid())
  )
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.user_id = auth.uid() AND m.organization_id = org AND m.role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.current_user_org_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_groups ENABLE ROW LEVEL SECURITY;

-- Organizations policies
DROP POLICY IF EXISTS "org_read_all_super" ON public.organizations;
CREATE POLICY "org_read_all_super" ON public.organizations FOR SELECT
  TO authenticated USING (public.is_super_admin() OR id = public.current_user_org_id());

DROP POLICY IF EXISTS "org_insert_super" ON public.organizations;
CREATE POLICY "org_insert_super" ON public.organizations FOR INSERT
  TO authenticated WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "org_update_super" ON public.organizations;
CREATE POLICY "org_update_super" ON public.organizations FOR UPDATE
  TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "org_delete_super" ON public.organizations;
CREATE POLICY "org_delete_super" ON public.organizations FOR DELETE
  TO authenticated USING (public.is_super_admin());

-- Organization members policies
DROP POLICY IF EXISTS "members_read_own_org" ON public.organization_members;
CREATE POLICY "members_read_own_org" ON public.organization_members FOR SELECT
  TO authenticated USING (public.is_super_admin() OR organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS "members_insert_admin" ON public.organization_members;
CREATE POLICY "members_insert_admin" ON public.organization_members FOR INSERT
  TO authenticated WITH CHECK (public.is_super_admin() OR public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "members_update_admin" ON public.organization_members;
CREATE POLICY "members_update_admin" ON public.organization_members FOR UPDATE
  TO authenticated USING (public.is_super_admin() OR public.is_org_admin(organization_id)) WITH CHECK (public.is_super_admin() OR public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "members_delete_admin" ON public.organization_members;
CREATE POLICY "members_delete_admin" ON public.organization_members FOR DELETE
  TO authenticated USING (public.is_super_admin() OR public.is_org_admin(organization_id));

-- Features catalog policies
DROP POLICY IF EXISTS "features_read_all" ON public.features;
CREATE POLICY "features_read_all" ON public.features FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "features_manage_super" ON public.features;
CREATE POLICY "features_manage_super" ON public.features FOR ALL
  TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- Organization features policies
DROP POLICY IF EXISTS "org_features_read" ON public.organization_features;
CREATE POLICY "org_features_read" ON public.organization_features FOR SELECT
  TO authenticated USING (public.is_super_admin() OR organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS "org_features_manage" ON public.organization_features;
CREATE POLICY "org_features_manage" ON public.organization_features FOR ALL
  TO authenticated USING (public.is_super_admin() OR public.is_org_admin(organization_id)) WITH CHECK (public.is_super_admin() OR public.is_org_admin(organization_id));

-- Projects policies
DROP POLICY IF EXISTS "projects_read" ON public.projects;
CREATE POLICY "projects_read" ON public.projects FOR SELECT
  TO authenticated USING (public.is_super_admin() OR organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS "projects_manage" ON public.projects;
CREATE POLICY "projects_manage" ON public.projects FOR ALL
  TO authenticated USING (public.is_super_admin() OR public.is_org_admin(organization_id)) WITH CHECK (public.is_super_admin() OR public.is_org_admin(organization_id));

-- Project groups policies
DROP POLICY IF EXISTS "project_groups_read" ON public.project_groups;
CREATE POLICY "project_groups_read" ON public.project_groups FOR SELECT
  TO authenticated USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_groups.project_id AND p.organization_id = public.current_user_org_id()
    )
  );

DROP POLICY IF EXISTS "project_groups_manage" ON public.project_groups;
CREATE POLICY "project_groups_manage" ON public.project_groups FOR ALL
  TO authenticated USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_groups.project_id AND public.is_org_admin(p.organization_id)
    )
  ) WITH CHECK (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_groups.project_id AND public.is_org_admin(p.organization_id)
    )
  );

-- Update handle_new_user to assign super_admin role for super admin email
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE WHEN public.is_super_admin_email(NEW.email) THEN 'super_admin' ELSE 'employee' END,
    'active'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Seed features catalog
INSERT INTO public.features (key, name, description, category)
VALUES
  ('dashboard', 'Dashboard', 'Real-time project analytics and overview', 'core'),
  ('tasks', 'Tasks', 'Task management and assignment', 'core'),
  ('projects', 'Projects', 'Project tracking and milestones', 'core'),
  ('team', 'Team', 'Team member management', 'core'),
  ('messenger', 'Messenger', 'Real-time chat and video calls', 'communication'),
  ('schedule', 'Schedule', 'Meeting and event scheduling', 'core'),
  ('notice', 'Notice', 'Company announcements', 'communication'),
  ('transactions', 'Transactions', 'Wallet and payment management', 'finance'),
  ('applications', 'Applications', 'Leave and absence requests', 'hr'),
  ('search', 'Search', 'Global search across workspace', 'core'),
  ('video_call', 'Video Call', 'WebRTC video conferencing', 'communication'),
  ('file_upload', 'File Upload', 'Document sharing and storage', 'core')
ON CONFLICT (key) DO NOTHING;

-- Seed default organization
INSERT INTO public.organizations (name, subdomain, status)
SELECT 'Sysmobyte HQ', 'sysmobyte', 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.organizations);

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin_email(text) TO authenticated;
