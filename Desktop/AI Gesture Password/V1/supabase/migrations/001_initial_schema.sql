-- =============================================================================
-- Ad-Forge SaaS Database Schema
-- Version: 1.0.0
--
-- This migration creates the complete database schema for multi-tenant SaaS.
-- Run this in your Supabase SQL Editor or via Supabase CLI.
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- Organizations (Tenants)
-- =============================================================================

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,

    -- Subscription
    subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
    subscription_status TEXT NOT NULL DEFAULT 'active' CHECK (subscription_status IN ('active', 'past_due', 'canceled', 'trialing')),
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT,

    -- Usage limits
    monthly_analysis_limit INTEGER NOT NULL DEFAULT 5,
    monthly_analyses_used INTEGER NOT NULL DEFAULT 0,

    -- Metadata
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for slug lookups
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer ON organizations(stripe_customer_id);

-- =============================================================================
-- Users
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,

    -- Organization membership
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),

    -- Metadata
    preferences JSONB DEFAULT '{}',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_organization ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =============================================================================
-- Invitations
-- =============================================================================

CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
    token TEXT UNIQUE NOT NULL,
    invited_by UUID NOT NULL REFERENCES users(id),

    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_organization ON invitations(organization_id);

-- =============================================================================
-- Projects (Campaigns)
-- =============================================================================

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),

    name TEXT NOT NULL,
    description TEXT,
    client_name TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),

    -- Metadata
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_organization ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- =============================================================================
-- Analyses
-- =============================================================================

CREATE TABLE IF NOT EXISTS analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id),

    -- Video info
    video_filename TEXT NOT NULL,
    video_path TEXT,
    video_storage_key TEXT,
    duration FLOAT,
    thumbnail_url TEXT,

    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    progress INTEGER DEFAULT 0,
    error TEXT,

    -- Results
    ai_breakdown JSONB,
    transcript TEXT,
    scenes JSONB DEFAULT '[]',

    -- Clearcast compliance
    clearcast_result JSONB,
    compliance_score FLOAT,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_analyses_organization ON analyses(organization_id);
CREATE INDEX IF NOT EXISTS idx_analyses_project ON analyses(project_id);
CREATE INDEX IF NOT EXISTS idx_analyses_status ON analyses(status);
CREATE INDEX IF NOT EXISTS idx_analyses_created ON analyses(created_at DESC);

-- =============================================================================
-- Ad Scripts (Ad Script Lab)
-- =============================================================================

CREATE TABLE IF NOT EXISTS ad_scripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),

    -- Script details
    product_name TEXT NOT NULL,
    product_description TEXT,
    duration INTEGER NOT NULL DEFAULT 30,
    tone TEXT DEFAULT 'professional',
    target_audience JSONB,
    key_messages TEXT[] DEFAULT '{}',
    call_to_action TEXT,
    style_references UUID[] DEFAULT '{}',
    industry TEXT,

    -- Generation
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
    versions JSONB DEFAULT '[]',
    selected_version INTEGER,
    compliance_check BOOLEAN DEFAULT true,

    -- Linked storyboard
    storyboard_id UUID,

    -- Metadata
    error TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_scripts_organization ON ad_scripts(organization_id);
CREATE INDEX IF NOT EXISTS idx_ad_scripts_status ON ad_scripts(status);

-- =============================================================================
-- Storyboards
-- =============================================================================

CREATE TABLE IF NOT EXISTS storyboards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),

    -- Links
    script_id UUID REFERENCES ad_scripts(id) ON DELETE SET NULL,
    analysis_id UUID REFERENCES analyses(id) ON DELETE SET NULL,

    -- Content
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
    frames JSONB DEFAULT '[]',
    total_duration FLOAT,
    frame_count INTEGER DEFAULT 8,

    -- Metadata
    error TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storyboards_organization ON storyboards(organization_id);
CREATE INDEX IF NOT EXISTS idx_storyboards_script ON storyboards(script_id);
CREATE INDEX IF NOT EXISTS idx_storyboards_analysis ON storyboards(analysis_id);

-- Add FK from ad_scripts to storyboards
ALTER TABLE ad_scripts
ADD CONSTRAINT fk_ad_scripts_storyboard
FOREIGN KEY (storyboard_id) REFERENCES storyboards(id) ON DELETE SET NULL;

-- =============================================================================
-- Reaction Sessions
-- =============================================================================

CREATE TABLE IF NOT EXISTS reaction_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),

    -- Session info
    participant_id TEXT,
    webcam_enabled BOOLEAN DEFAULT true,

    -- Recording
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'recording', 'processing', 'completed', 'failed')),
    recording_started_at TIMESTAMPTZ,
    duration FLOAT,
    frame_count INTEGER DEFAULT 0,

    -- Data
    emotion_timeline JSONB DEFAULT '[]',
    summary JSONB,

    -- Metadata
    error TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reaction_sessions_organization ON reaction_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_reaction_sessions_analysis ON reaction_sessions(analysis_id);
CREATE INDEX IF NOT EXISTS idx_reaction_sessions_status ON reaction_sessions(status);

-- =============================================================================
-- Media Reports
-- =============================================================================

CREATE TABLE IF NOT EXISTS media_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id),

    -- File info
    filename TEXT NOT NULL,
    file_type TEXT,
    storage_key TEXT,

    -- Parsed data
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    parsed_data JSONB,
    spots_count INTEGER DEFAULT 0,

    -- Metadata
    error TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_reports_organization ON media_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_media_reports_project ON media_reports(project_id);

-- =============================================================================
-- API Keys (for Enterprise tier)
-- =============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id),

    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    key_prefix TEXT NOT NULL, -- First 8 chars for identification

    -- Permissions
    scopes TEXT[] DEFAULT '{read}',

    -- Usage
    last_used_at TIMESTAMPTZ,
    usage_count INTEGER DEFAULT 0,

    -- Status
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_organization ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);

-- =============================================================================
-- Audit Log
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Event
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,

    -- Context
    ip_address INET,
    user_agent TEXT,

    -- Data
    old_values JSONB,
    new_values JSONB,
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_organization ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- =============================================================================
-- Row Level Security (RLS) Policies
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE storyboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE reaction_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Organizations: Users can only see their own organization
CREATE POLICY "Users can view own organization" ON organizations
    FOR SELECT USING (
        id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    );

CREATE POLICY "Owners can update organization" ON organizations
    FOR UPDATE USING (
        id IN (SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'owner')
    );

-- Users: Can see members of their organization
CREATE POLICY "Users can view organization members" ON users
    FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    );

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (id = auth.uid());

-- Projects: Organization-scoped access
CREATE POLICY "Users can view organization projects" ON projects
    FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    );

CREATE POLICY "Members can create projects" ON projects
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users
            WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
        )
    );

CREATE POLICY "Members can update projects" ON projects
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id FROM users
            WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
        )
    );

CREATE POLICY "Admins can delete projects" ON projects
    FOR DELETE USING (
        organization_id IN (
            SELECT organization_id FROM users
            WHERE id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Analyses: Organization-scoped
CREATE POLICY "Users can view organization analyses" ON analyses
    FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    );

CREATE POLICY "Members can create analyses" ON analyses
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users
            WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
        )
    );

CREATE POLICY "Members can update analyses" ON analyses
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id FROM users
            WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
        )
    );

CREATE POLICY "Admins can delete analyses" ON analyses
    FOR DELETE USING (
        organization_id IN (
            SELECT organization_id FROM users
            WHERE id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Ad Scripts: Organization-scoped
CREATE POLICY "Users can view organization scripts" ON ad_scripts
    FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    );

CREATE POLICY "Members can manage scripts" ON ad_scripts
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users
            WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
        )
    );

-- Storyboards: Organization-scoped
CREATE POLICY "Users can view organization storyboards" ON storyboards
    FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    );

CREATE POLICY "Members can manage storyboards" ON storyboards
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users
            WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
        )
    );

-- Reaction Sessions: Organization-scoped
CREATE POLICY "Users can view organization reaction sessions" ON reaction_sessions
    FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    );

CREATE POLICY "Members can manage reaction sessions" ON reaction_sessions
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users
            WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
        )
    );

-- Media Reports: Organization-scoped
CREATE POLICY "Users can view organization media reports" ON media_reports
    FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    );

CREATE POLICY "Members can manage media reports" ON media_reports
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users
            WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
        )
    );

-- API Keys: Only admins/owners can manage
CREATE POLICY "Admins can view API keys" ON api_keys
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM users
            WHERE id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Admins can manage API keys" ON api_keys
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users
            WHERE id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Invitations: Only admins/owners can manage
CREATE POLICY "Admins can view invitations" ON invitations
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM users
            WHERE id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Admins can manage invitations" ON invitations
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users
            WHERE id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Audit Logs: Read-only for admins
CREATE POLICY "Admins can view audit logs" ON audit_logs
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM users
            WHERE id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- =============================================================================
-- Functions
-- =============================================================================

-- Function to create user record on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    org_id UUID;
BEGIN
    -- Create a new organization for the user
    INSERT INTO organizations (name, slug)
    VALUES (
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || '''s Organization',
        LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), ' ', '-')) || '-' || SUBSTRING(NEW.id::TEXT, 1, 8)
    )
    RETURNING id INTO org_id;

    -- Create user record
    INSERT INTO users (id, email, full_name, avatar_url, organization_id, role)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url',
        org_id,
        'owner'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_analyses_updated_at BEFORE UPDATE ON analyses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ad_scripts_updated_at BEFORE UPDATE ON ad_scripts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_storyboards_updated_at BEFORE UPDATE ON storyboards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reaction_sessions_updated_at BEFORE UPDATE ON reaction_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_media_reports_updated_at BEFORE UPDATE ON media_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to reset monthly usage (called by cron)
CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS void AS $$
BEGIN
    UPDATE organizations SET monthly_analyses_used = 0;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Storage Buckets
-- =============================================================================

-- Create storage buckets (run in Supabase dashboard or via CLI)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('videos', 'videos', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('thumbnails', 'thumbnails', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('storyboards', 'storyboards', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', false);

-- =============================================================================
-- Grants for service role
-- =============================================================================

-- The service role needs full access for backend operations
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
