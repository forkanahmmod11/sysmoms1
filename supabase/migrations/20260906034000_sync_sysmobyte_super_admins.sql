/*
  Sync designated Sysmobyte platform-admin accounts with the frontend RBAC.

  Existing users are NOT re-run through auth.users INSERT triggers, so accounts
  created before the super_admin role was introduced can remain `admin`.
*/

CREATE OR REPLACE FUNCTION public.is_super_admin_email(e text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT lower(trim(coalesce(e, ''))) IN (
    'ahmedforkan26@gmail.com',
    'forkanahmmod@gmail.com',
    'admin@sysmobyte.com'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_email(e text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT lower(trim(coalesce(e, ''))) IN (
    'ahmedforkan26@gmail.com',
    'forkanahmmod@gmail.com',
    'admin@sysmobyte.com'
  )
$$;

-- Promote already-existing designated platform-admin profiles.
UPDATE public.profiles
SET role = 'super_admin', updated_at = now()
WHERE public.is_super_admin_email(email);

-- Keep future signups consistent with the same source of truth.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE WHEN public.is_super_admin_email(NEW.email) THEN 'super_admin' ELSE 'employee' END,
    'active'
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        role = CASE
          WHEN public.is_super_admin_email(EXCLUDED.email) THEN 'super_admin'
          ELSE public.profiles.role
        END,
        updated_at = now();
  RETURN NEW;
END;
$$;
