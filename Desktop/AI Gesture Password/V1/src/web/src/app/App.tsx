import './App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@shared/components/Layout';
import { ProjectView } from '@features/project-view/ProjectView';
import { ClearcastReport } from '@features/clearcast-report/ClearcastReport';
import { Projects } from '@features/projects/Projects';
import { Dashboard } from '@features/dashboard/Dashboard';
import { ReactionRecorder } from '@features/reaction-recorder/ReactionRecorder';
import { ReactionMetrics } from '@features/reaction-metrics/ReactionMetrics';
import { AdScriptLab } from '@features/ad-script-lab/AdScriptLab';
import { AdminDashboard } from '@features/ad-script-lab/components/admin';
import { StoryboardView } from '@features/storyboards/StoryboardView';
import { ReportConsolidator } from '@features/report-consolidator/ReportConsolidator';
import { ComplianceCheck } from '@features/compliance-check/ComplianceCheck';
import { LoadingProvider } from '@shared/context/LoadingContext';
import { BackendStatusProvider } from '@shared/context/BackendStatusContext';
import { GlobalLoading } from '@shared/components/GlobalLoading';
import { ErrorBoundary } from '@shared/components/ErrorBoundary';
import { ToastProvider } from '@shared/components/Toast';
import { BackendDisconnectedOverlay } from '@shared/components/BackendStatusIndicator';
import { Settings } from '@features/settings/Settings';

// Auth imports
import {
  AuthProvider,
  ProtectedRoute,
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  AuthCallback,
} from '@features/auth';

/**
 * Protected Layout wrapper
 * Wraps authenticated routes with the main layout
 */
function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

/**
 * Pro tier protected route wrapper
 */
function ProRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requiredTier="pro">
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <ToastProvider>
      <LoadingProvider>
        <BackendStatusProvider>
          <AuthProvider>
            <ErrorBoundary>
              <GlobalLoading />
              <BackendDisconnectedOverlay />
              <BrowserRouter>
                <Routes>
                  {/* Public auth routes - no layout */}
                  <Route path="/auth/login" element={<LoginPage />} />
                  <Route path="/auth/register" element={<RegisterPage />} />
                  <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />

                  {/* Protected routes - with layout */}
                  <Route
                    path="/"
                    element={
                      <ProtectedLayout>
                        <Dashboard />
                      </ProtectedLayout>
                    }
                  />
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedLayout>
                        <Dashboard />
                      </ProtectedLayout>
                    }
                  />
                  <Route
                    path="/projects"
                    element={
                      <ProtectedLayout>
                        <Projects />
                      </ProtectedLayout>
                    }
                  />
                  <Route
                    path="/project/:id"
                    element={
                      <ProtectedLayout>
                        <ProjectView />
                      </ProtectedLayout>
                    }
                  />
                  <Route
                    path="/clearcast/:id"
                    element={
                      <ProtectedLayout>
                        <ClearcastReport />
                      </ProtectedLayout>
                    }
                  />
                  <Route
                    path="/compliance-check"
                    element={
                      <ProtectedLayout>
                        <ComplianceCheck />
                      </ProtectedLayout>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <ProtectedLayout>
                        <Settings />
                      </ProtectedLayout>
                    }
                  />

                  {/* Pro tier routes */}
                  <Route
                    path="/ad-script-lab"
                    element={
                      <ProRoute>
                        <AdScriptLab />
                      </ProRoute>
                    }
                  />
                  <Route
                    path="/ad-script-lab/admin"
                    element={
                      <ProRoute>
                        <AdminDashboard />
                      </ProRoute>
                    }
                  />
                  <Route
                    path="/storyboards"
                    element={
                      <ProRoute>
                        <StoryboardView />
                      </ProRoute>
                    }
                  />
                  <Route
                    path="/record-reaction/:id"
                    element={
                      <ProRoute>
                        <ReactionRecorder />
                      </ProRoute>
                    }
                  />
                  <Route
                    path="/reaction-metrics/:id"
                    element={
                      <ProRoute>
                        <ReactionMetrics />
                      </ProRoute>
                    }
                  />
                  <Route
                    path="/report-consolidator"
                    element={
                      <ProRoute>
                        <ReportConsolidator />
                      </ProRoute>
                    }
                  />

                  {/* Catch all - redirect to dashboard */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </BrowserRouter>
            </ErrorBoundary>
          </AuthProvider>
        </BackendStatusProvider>
      </LoadingProvider>
    </ToastProvider>
  );
}

export default App;
