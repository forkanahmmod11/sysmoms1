/*
# Sysmobyte core schema (profiles + departments)

1. New Tables
- `profiles` — extends auth.users with display data (full_name, role, avatar_url, cover_url, bio, skills, department_id, status).
  - role: 'admin' | 'moderator' | 'employee'
  - status: 'active' | 'away' | 'offline'
- `departments` — organizational units with a name, description, and an optional moderator.
2. Security
- Enable RLS on both tables.
- profiles: each authenticated user can read all profiles (directory) but only update their own.
- departments: readable by all authenticated users; only admins/moderators may manage.
3. Notes
- A trigger `handle_new_user` creates a profile row automatically when a new auth.users row is created, defaulting role to 'employee' (admin for ahmedforkan26@gmail.com).
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  role text NOT NULL DEFAULT 'employee' CHECK (role IN ('admin','moderator','employee')),
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('active','away','offline')),
  avatar_url text,
  cover_url text,
  bio text,
  skills text[] DEFAULT '{}',
  department_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  moderator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- link profiles.department_id to departments now that both tables exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_department_id_fkey' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_department_id_fkey
      FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- profiles policies
DROP POLICY IF EXISTS "profiles_read_all" ON public.profiles;
CREATE POLICY "profiles_read_all" ON public.profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- departments policies
DROP POLICY IF EXISTS "departments_read_all" ON public.departments;
CREATE POLICY "departments_read_all" ON public.departments FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "departments_manage_admin" ON public.departments;
CREATE POLICY "departments_manage_admin" ON public.departments FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','moderator'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','moderator'))
  );

-- helper: is admin email
CREATE OR REPLACE FUNCTION public.is_admin_email(e text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT lower(e) = 'ahmedforkan26@gmail.com'
$$;

-- trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE WHEN public.is_admin_email(NEW.email) THEN 'admin' ELSE 'employee' END,
    'active'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- seed a default department
INSERT INTO public.departments (name, description)
SELECT 'General', 'Default department for all employees'
WHERE NOT EXISTS (SELECT 1 FROM public.departments);
