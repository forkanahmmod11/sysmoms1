/*
# Sysmobyte multi-tenant RBAC: organizations, roles, members, features, projects

1. New Tables
- `organizations` — each tenant/workspace (name, subdomain, created_by, status).
- `organization_members` — joins users to orgs with a role.
- `features` — catalog of toggleable OMS features.
- `organization_features` — which features are enabled per org.
- `projects` — projects belong to an org.
- `project_groups` — sub-groups within a project.

2. Modified Tables
- `profiles.role` CHECK constraint updated to include the full role catalog.
- `profiles` gains `organization_id` (nullable) for the user's primary org.

3. Security
- RLS enabled on all new tables with super_admin and org-admin scoped policies.

4. Notes
- Seed data: default features catalog, a default organization.
*/

-- Update profiles role check to include full role catalog
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin','admin','moderator','full_stack_developer','backend_developer','frontend_developer','graphics_video_editor','marketing_specialist','hr','employee'));

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

-- grant execute on helper functions
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin_email(text) TO authenticated;
