-- Sysmobyte social/profile/public-posts/secrets layer.
-- Apply after the existing 20260906123000 SaaS onboarding migration.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS certification_links text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text,
  content text NOT NULL,
  cover_url text,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction text NOT NULL DEFAULT 'like',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author ON public.posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_public ON public.posts(is_public, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_comments_post ON public.post_comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_post_reactions_post ON public.post_reactions(post_id);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS posts_read ON public.posts;
CREATE POLICY posts_read ON public.posts FOR SELECT TO authenticated
USING (
  is_public
  OR author_id = auth.uid()
  OR organization_id = public.current_user_org_id()
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS posts_insert ON public.posts;
CREATE POLICY posts_insert ON public.posts FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    (
      COALESCE(is_public, false) = false
      AND organization_id = public.current_user_org_id()
      AND organization_id IS NOT NULL
    )
    OR public.is_super_admin()
    OR (
      COALESCE(is_public, false) = true
      AND organization_id = public.current_user_org_id()
      AND organization_id IS NOT NULL
      AND public.is_org_admin(organization_id)
    )
  )
);

DROP POLICY IF EXISTS posts_update ON public.posts;
CREATE POLICY posts_update ON public.posts FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR author_id = auth.uid()
  OR (organization_id IS NOT NULL AND public.is_org_admin(organization_id))
)
WITH CHECK (
  public.is_super_admin()
  OR author_id = auth.uid()
  OR (organization_id IS NOT NULL AND public.is_org_admin(organization_id))
);

DROP POLICY IF EXISTS posts_delete ON public.posts;
CREATE POLICY posts_delete ON public.posts FOR DELETE TO authenticated
USING (
  public.is_super_admin()
  OR author_id = auth.uid()
  OR (organization_id IS NOT NULL AND public.is_org_admin(organization_id))
);

DROP POLICY IF EXISTS post_comments_read ON public.post_comments;
CREATE POLICY post_comments_read ON public.post_comments FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND (
    p.is_public OR p.author_id = auth.uid() OR p.organization_id = public.current_user_org_id() OR public.is_super_admin()
  ))
);

DROP POLICY IF EXISTS post_comments_insert ON public.post_comments;
CREATE POLICY post_comments_insert ON public.post_comments FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND (
    p.is_public OR p.organization_id = public.current_user_org_id() OR p.author_id = auth.uid() OR public.is_super_admin()
  ))
);

DROP POLICY IF EXISTS post_comments_delete ON public.post_comments;
CREATE POLICY post_comments_delete ON public.post_comments FOR DELETE TO authenticated
USING (author_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS post_reactions_read ON public.post_reactions;
CREATE POLICY post_reactions_read ON public.post_reactions FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND (
    p.is_public OR p.organization_id = public.current_user_org_id() OR p.author_id = auth.uid() OR public.is_super_admin()
  ))
);

DROP POLICY IF EXISTS post_reactions_write ON public.post_reactions;
CREATE POLICY post_reactions_write ON public.post_reactions FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND (
    p.is_public OR p.organization_id = public.current_user_org_id() OR p.author_id = auth.uid() OR public.is_super_admin()
  ))
);

DROP POLICY IF EXISTS post_reactions_delete ON public.post_reactions;
CREATE POLICY post_reactions_delete ON public.post_reactions FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin());

-- Public-post controls for workspace admins. Super admins may publish platform-wide.
CREATE OR REPLACE FUNCTION public.create_public_post(
  p_title text,
  p_content text,
  p_cover_url text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid; v_org uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  v_org := public.current_user_org_id();
  IF NOT public.is_super_admin() AND (v_org IS NULL OR NOT public.is_org_admin(v_org)) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  INSERT INTO public.posts(author_id, organization_id, title, content, cover_url, is_public)
  VALUES (auth.uid(), CASE WHEN public.is_super_admin() THEN NULL ELSE v_org END, NULLIF(trim(p_title),''), trim(p_content), NULLIF(trim(p_cover_url),''), true)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_public_post(text,text,text) TO authenticated;

-- Secure platform secret management through Supabase Vault.
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

CREATE OR REPLACE FUNCTION public.list_platform_secrets()
RETURNS TABLE(id uuid, name text, description text, created_at timestamptz, updated_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public, vault
AS $$
  SELECT s.id, s.name, s.description, s.created_at, s.updated_at
  FROM vault.secrets s
  WHERE public.is_super_admin()
  ORDER BY s.updated_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.upsert_platform_secret(
  p_name text,
  p_value text,
  p_description text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Super admin required'; END IF;
  IF NULLIF(trim(p_name),'') IS NULL OR NULLIF(p_value,'') IS NULL THEN
    RAISE EXCEPTION 'Secret name and value are required';
  END IF;

  SELECT id INTO v_id FROM vault.secrets WHERE name = trim(p_name) LIMIT 1;
  IF v_id IS NULL THEN
    v_id := vault.create_secret(p_value, trim(p_name), NULLIF(trim(p_description),''));
  ELSE
    PERFORM vault.update_secret(v_id, p_value, trim(p_name), NULLIF(trim(p_description),''));
  END IF;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_platform_secrets() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_platform_secret(text,text,text) TO authenticated;

-- Do not expose Vault's decrypted view through the PostgREST API.
REVOKE ALL ON TABLE vault.decrypted_secrets FROM anon, authenticated;
