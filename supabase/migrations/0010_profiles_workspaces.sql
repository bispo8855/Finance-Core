-- 0010_profiles_workspaces.sql

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  onboarding_completed BOOLEAN DEFAULT false,
  full_name TEXT,
  display_name TEXT,
  avatar_initials TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create workspaces table
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Minha Empresa',
  legal_name TEXT,
  document_number TEXT,
  workspace_type TEXT NOT NULL DEFAULT 'business' CONSTRAINT chk_workspace_type CHECK (workspace_type IN ('business', 'personal')),
  avatar_initials TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create workspace_members table
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner' CONSTRAINT chk_workspace_role CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON public.workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

DROP POLICY IF EXISTS "Users can view workspaces they belong to" ON public.workspaces;
DROP POLICY IF EXISTS "Owners or admins can update workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Owners can insert workspaces" ON public.workspaces;

DROP POLICY IF EXISTS "Members can view workspace membership" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners or admins can manage membership" ON public.workspace_members;

-- Profiles Policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Workspaces Policies
CREATE POLICY "Users can view workspaces they belong to" ON public.workspaces
  FOR SELECT USING (
    id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Owners or admins can update workspaces" ON public.workspaces
  FOR UPDATE USING (
    id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid() AND (role = 'owner' OR role = 'admin')
    )
  );

CREATE POLICY "Owners can insert workspaces" ON public.workspaces
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Workspace Members Policies
CREATE POLICY "Members can view workspace membership" ON public.workspace_members
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Owners or admins can manage membership" ON public.workspace_members
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid() AND (role = 'owner' OR role = 'admin')
    )
  );

-- 6. Updated At Trigger Function
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Set up triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON public.profiles 
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS update_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER update_workspaces_updated_at 
  BEFORE UPDATE ON public.workspaces 
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- 7. Trigger for Automatic Profile and Workspace Creation for New Users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_workspace_id UUID;
BEGIN
  -- Insert profile protecting with ON CONFLICT
  INSERT INTO public.profiles (id, full_name, display_name, avatar_initials)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    COALESCE(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    ''
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insert default business workspace if user doesn't already have one
  IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE owner_id = new.id) THEN
    INSERT INTO public.workspaces (owner_id, name, workspace_type)
    VALUES (new.id, 'Minha Empresa', 'business')
    RETURNING id INTO new_workspace_id;

    -- Add user as owner in members with ON CONFLICT protect
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (new_workspace_id, new.id, 'owner')
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Backfill Existing Users (Safe to run multiple times)
INSERT INTO public.profiles (id, onboarding_completed, full_name, display_name, avatar_initials)
SELECT 
  id,
  true,
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', ''),
  COALESCE(raw_user_meta_data->>'display_name', raw_user_meta_data->>'name', split_part(email, '@', 1)),
  ''
FROM auth.users
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  r RECORD;
  new_ws_id UUID;
BEGIN
  FOR r IN SELECT id FROM auth.users LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.workspace_members WHERE user_id = r.id
    ) THEN
      INSERT INTO public.workspaces (owner_id, name, workspace_type)
      VALUES (r.id, 'Minha Empresa', 'business')
      RETURNING id INTO new_ws_id;

      INSERT INTO public.workspace_members (workspace_id, user_id, role)
      VALUES (new_ws_id, r.id, 'owner')
      ON CONFLICT (workspace_id, user_id) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;
