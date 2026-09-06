-- SaaS onboarding: every customer gets an isolated organization and the creator is its admin.
-- Replaces the old bootstrap behavior that placed all users in Sysmobyte HQ.

ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_status_check;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_status_check CHECK (status IN ('pending','active','suspended','archived'));

CREATE TABLE IF NOT EXISTS public.workspace_onboarding (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  website text,
  industry text,
  company_size text,
  country text,
  company_address text,
  business_description text,
  registration_number text,
  representative_name text,
  phone text,
  verification_status text NOT NULL DEFAULT 'submitted' CHECK (verification_status IN ('draft','submitted','verified','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workspace_onboarding ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS onboarding_own_select ON public.workspace_onboarding;
CREATE POLICY onboarding_own_select ON public.workspace_onboarding FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());
DROP POLICY IF EXISTS onboarding_own_insert ON public.workspace_onboarding;
CREATE POLICY onboarding_own_insert ON public.workspace_onboarding FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS onboarding_own_update ON public.workspace_onboarding;
CREATE POLICY onboarding_own_update ON public.workspace_onboarding FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_role text;
BEGIN
  new_role := CASE WHEN public.is_super_admin_email(NEW.email) THEN 'super_admin' ELSE 'employee' END;
  INSERT INTO public.profiles (id, email, full_name, role, status, organization_id)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    new_role, 'active', NULL
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = CASE WHEN public.is_super_admin_email(EXCLUDED.email) THEN 'super_admin' ELSE public.profiles.role END,
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.create_isolated_workspace(
  p_company_name text,
  p_website text DEFAULT NULL,
  p_industry text DEFAULT NULL,
  p_company_size text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_company_address text DEFAULT NULL,
  p_business_description text DEFAULT NULL,
  p_registration_number text DEFAULT NULL,
  p_representative_name text DEFAULT NULL,
  p_phone text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_org uuid; v_slug text; v_base text; v_i integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND organization_id IS NOT NULL) THEN
    RETURN (SELECT organization_id FROM public.profiles WHERE id = auth.uid());
  END IF;

  v_base := lower(regexp_replace(coalesce(p_company_name,'workspace'), '[^a-zA-Z0-9]+', '-', 'g'));
  v_base := trim(both '-' from v_base);
  v_slug := left(coalesce(nullif(v_base,''),'workspace'), 50);
  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE subdomain = v_slug) LOOP
    v_i := v_i + 1;
    v_slug := left(v_base, 44) || '-' || v_i::text;
  END LOOP;

  INSERT INTO public.organizations(name, subdomain, status, created_by)
  VALUES (p_company_name, v_slug, 'pending', auth.uid()) RETURNING id INTO v_org;

  INSERT INTO public.organization_members(organization_id, user_id, role)
  VALUES (v_org, auth.uid(), 'admin');

  UPDATE public.profiles SET organization_id = v_org, role = 'admin', updated_at = now()
  WHERE id = auth.uid();

  INSERT INTO public.workspace_onboarding(
    user_id, company_name, website, industry, company_size, country, company_address,
    business_description, registration_number, representative_name, phone, verification_status
  ) VALUES (
    auth.uid(), p_company_name, p_website, p_industry, p_company_size, p_country, p_company_address,
    p_business_description, p_registration_number, p_representative_name, p_phone, 'submitted'
  ) ON CONFLICT (user_id) DO UPDATE SET
    company_name=EXCLUDED.company_name, website=EXCLUDED.website, industry=EXCLUDED.industry,
    company_size=EXCLUDED.company_size, country=EXCLUDED.country, company_address=EXCLUDED.company_address,
    business_description=EXCLUDED.business_description, registration_number=EXCLUDED.registration_number,
    representative_name=EXCLUDED.representative_name, phone=EXCLUDED.phone, verification_status='submitted', updated_at=now();

  INSERT INTO public.organization_features(organization_id, feature_id, enabled)
  SELECT v_org, id, false FROM public.features
  ON CONFLICT (organization_id, feature_id) DO UPDATE SET enabled=false;

  RETURN v_org;
END;
$$;

CREATE TABLE IF NOT EXISTS public.subscription_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_email text,
  user_name text,
  plan_id text NOT NULL,
  plan_name text NOT NULL,
  organization_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  payment_status text NOT NULL DEFAULT 'submitted' CHECK (payment_status IN ('none','submitted','verified','rejected')),
  payment_method text CHECK (payment_method IN ('bkash','upay','citytouch')),
  payment_reference text,
  document_urls text[] NOT NULL DEFAULT '{}',
  screenshot_urls text[] NOT NULL DEFAULT '{}',
  admin_notes text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_requests ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.subscription_requests ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'submitted';
ALTER TABLE public.subscription_requests ADD COLUMN IF NOT EXISTS payment_method text CHECK (payment_method IN ('bkash','upay','citytouch'));
ALTER TABLE public.subscription_requests ADD COLUMN IF NOT EXISTS payment_reference text;

ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subscription_own_select ON public.subscription_requests;
CREATE POLICY subscription_own_select ON public.subscription_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());
DROP POLICY IF EXISTS subscription_own_insert ON public.subscription_requests;
CREATE POLICY subscription_own_insert ON public.subscription_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS subscription_super_update ON public.subscription_requests;
CREATE POLICY subscription_super_update ON public.subscription_requests FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.approve_subscription_request(req_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r public.subscription_requests%ROWTYPE;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Super admin required'; END IF;
  SELECT * INTO r FROM public.subscription_requests WHERE id=req_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF r.organization_id IS NULL THEN RAISE EXCEPTION 'Workspace not found'; END IF;

  UPDATE public.subscription_requests SET status='approved', payment_status='verified', reviewed_at=now(), reviewed_by=auth.uid()
  WHERE id=req_id;
  UPDATE public.organizations SET status='active' WHERE id=r.organization_id;
  UPDATE public.organization_features SET enabled=true WHERE organization_id=r.organization_id;
  UPDATE public.profiles SET role='admin', organization_id=r.organization_id WHERE id=r.user_id;
  INSERT INTO public.organization_members(organization_id,user_id,role) VALUES(r.organization_id,r.user_id,'admin')
  ON CONFLICT (organization_id,user_id) DO UPDATE SET role='admin';
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_isolated_workspace(text,text,text,text,text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_subscription_request(uuid) TO authenticated;
