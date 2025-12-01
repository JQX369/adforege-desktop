/**
 * Authentication Context
 *
 * Provides auth state and user info throughout the app.
 * Wraps the app and handles session persistence.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { Navigate } from 'react-router-dom';
import {
  supabase,
  signIn as supabaseSignIn,
  signUp as supabaseSignUp,
  signOut as supabaseSignOut,
  signInWithProvider,
  getSession,
  onAuthStateChange,
  type Session,
  type User,
  type UserProfile,
  type Organization,
} from '@lib/supabase';

// =============================================================================
// Types
// =============================================================================

interface AuthContextType {
  // State
  user: User | null;
  profile: UserProfile | null;
  organization: Organization | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Auth actions
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;

  // Profile actions
  refreshProfile: () => Promise<void>;
  refreshOrganization: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// =============================================================================
// Provider
// =============================================================================

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user profile from our users table
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data as UserProfile);
      return data as UserProfile;
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setProfile(null);
      return null;
    }
  }, []);

  // Fetch organization details
  const fetchOrganization = useCallback(async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single();

      if (error) throw error;
      setOrganization(data as Organization);
      return data as Organization;
    } catch (err) {
      console.error('Failed to fetch organization:', err);
      setOrganization(null);
      return null;
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const session = await getSession();

        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);

          if (session?.user) {
            const profile = await fetchProfile(session.user.id);
            if (profile?.organization_id) {
              await fetchOrganization(profile.organization_id);
            }
          }
        }
      } catch (err) {
        console.error('Auth init error:', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    // Subscribe to auth changes
    const subscription = onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await fetchProfile(session.user.id);
        if (profile?.organization_id) {
          await fetchOrganization(profile.organization_id);
        }
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setOrganization(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, fetchOrganization]);

  // Auth actions
  const signIn = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      await supabaseSignIn(email, password);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName?: string) => {
    setIsLoading(true);
    try {
      await supabaseSignUp(email, password, fullName);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      await supabaseSignOut();
      setUser(null);
      setProfile(null);
      setOrganization(null);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await signInWithProvider('google');
  }, []);

  // Refresh helpers
  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  const refreshOrganization = useCallback(async () => {
    if (profile?.organization_id) {
      await fetchOrganization(profile.organization_id);
    }
  }, [profile, fetchOrganization]);

  const value: AuthContextType = {
    user,
    profile,
    organization,
    session,
    isLoading,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
    refreshProfile,
    refreshOrganization,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// =============================================================================
// Hook
// =============================================================================

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

// =============================================================================
// Protected Route Component
// =============================================================================

interface ProtectedRouteProps {
  children: ReactNode;
  requiredTier?: 'pro' | 'enterprise';
  requiredRole?: 'owner' | 'admin';
  fallback?: ReactNode;
}

export function ProtectedRoute({
  children,
  requiredTier,
  requiredRole,
  fallback,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, organization, profile } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login or show fallback
    if (fallback) return <>{fallback}</>;
    return <Navigate to="/auth/login" replace />;
  }

  // Check subscription tier
  if (requiredTier) {
    const tierOrder = ['free', 'pro', 'enterprise'];
    const currentTierIndex = tierOrder.indexOf(organization?.subscription_tier || 'free');
    const requiredTierIndex = tierOrder.indexOf(requiredTier);

    if (currentTierIndex < requiredTierIndex) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8">
          <h2 className="text-xl font-semibold mb-4">Upgrade Required</h2>
          <p className="text-gray-400 mb-6">
            This feature requires a {requiredTier} subscription.
          </p>
          <a
            href="/settings/billing"
            className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500"
          >
            Upgrade Now
          </a>
        </div>
      );
    }
  }

  // Check role
  if (requiredRole) {
    const roleOrder = ['viewer', 'member', 'admin', 'owner'];
    const currentRoleIndex = roleOrder.indexOf(profile?.role || 'member');
    const requiredRoleIndex = roleOrder.indexOf(requiredRole);

    if (currentRoleIndex < requiredRoleIndex) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8">
          <h2 className="text-xl font-semibold mb-4">Access Denied</h2>
          <p className="text-gray-400">
            You don't have permission to access this page.
          </p>
        </div>
      );
    }
  }

  return <>{children}</>;
}

// =============================================================================
// Subscription Check Hook
// =============================================================================

export function useSubscription() {
  const { organization } = useAuth();

  const tier = organization?.subscription_tier || 'free';
  const isActive = organization?.subscription_status === 'active';

  return {
    tier,
    isActive,
    isPro: tier === 'pro' || tier === 'enterprise',
    isEnterprise: tier === 'enterprise',
    analysisLimit: organization?.monthly_analysis_limit || 5,
    analysesUsed: organization?.monthly_analyses_used || 0,
    analysesRemaining: Math.max(
      0,
      (organization?.monthly_analysis_limit || 5) -
        (organization?.monthly_analyses_used || 0)
    ),
    canAnalyze:
      tier === 'enterprise' ||
      (organization?.monthly_analyses_used || 0) <
        (organization?.monthly_analysis_limit || 5),
  };
}
