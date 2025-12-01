import './App.css';
import { HashRouter, Routes, Route } from 'react-router-dom';
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



function App() {
  return (
    <ToastProvider>
      <LoadingProvider>
        <BackendStatusProvider>
          <ErrorBoundary>
            <GlobalLoading />
            <BackendDisconnectedOverlay />
            <HashRouter>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/projects" element={<Projects />} />
                  <Route path="/ad-script-lab" element={<AdScriptLab />} />
                  <Route path="/ad-script-lab/admin" element={<AdminDashboard />} />
                  <Route path="/storyboards" element={<StoryboardView />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/project/:id" element={<ProjectView />} />
                  <Route path="/clearcast/:id" element={<ClearcastReport />} />
                  <Route path="/record-reaction/:id" element={<ReactionRecorder />} />
                  <Route path="/reaction-metrics/:id" element={<ReactionMetrics />} />
                  <Route path="/report-consolidator" element={<ReportConsolidator />} />
                  <Route path="/compliance-check" element={<ComplianceCheck />} />
                </Routes>
              </Layout>
            </HashRouter>
          </ErrorBoundary>
        </BackendStatusProvider>
      </LoadingProvider>
    </ToastProvider>
  );
}

export default App;
