-- Ensure every authenticated account gets a usable default workspace.
-- This removes the dead-end after signup and also repairs existing profiles.

DO $$
DECLARE
  default_org uuid;
BEGIN
  SELECT id INTO default_org
  FROM public.organizations
  WHERE subdomain = 'sysmobyte'
  ORDER BY created_at
  LIMIT 1;

  IF default_org IS NULL THEN
    INSERT INTO public.organizations (name, subdomain, status)
    VALUES ('Sysmobyte HQ', 'sysmobyte', 'active')
    RETURNING id INTO default_org;
  END IF;

  UPDATE public.profiles
  SET organization_id = default_org, updated_at = now()
  WHERE organization_id IS NULL;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  SELECT default_org, p.id,
         CASE WHEN p.role IN ('super_admin','admin') THEN p.role ELSE 'employee' END
  FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = default_org AND om.user_id = p.id
  );
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_org uuid;
  new_role text;
BEGIN
  new_role := CASE WHEN public.is_super_admin_email(NEW.email) THEN 'super_admin' ELSE 'employee' END;

  SELECT id INTO default_org
  FROM public.organizations
  WHERE subdomain = 'sysmobyte'
  ORDER BY created_at
  LIMIT 1;

  IF default_org IS NULL THEN
    INSERT INTO public.organizations (name, subdomain, status)
    VALUES ('Sysmobyte HQ', 'sysmobyte', 'active')
    RETURNING id INTO default_org;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, status, organization_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    new_role,
    'active',
    default_org
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    organization_id = COALESCE(public.profiles.organization_id, EXCLUDED.organization_id),
    role = CASE WHEN public.is_super_admin_email(EXCLUDED.email) THEN 'super_admin' ELSE public.profiles.role END,
    updated_at = now();

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (default_org, NEW.id, new_role)
  ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

