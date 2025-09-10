import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { ThemeProvider } from "@/hooks/use-theme";
import Index from "./pages/Index";
import CompletedEvents from "./pages/CompletedEvents";
import UpcomingEvents from "./pages/UpcomingEvents";
import UsersPage from "./pages/Users";
import CatalogHealth from "./pages/CatalogHealth";
import Top25Tracks from "./pages/Top25Tracks";
import RoadmapPage from "./pages/RoadmapPage";
import LocalizedTracksPage from "./pages/LocalizedTracksPage";
import ParticipantFeedbackPage from "./pages/ParticipantFeedbackPage";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";

const queryClient = new QueryClient();

const RequireAuth = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('dashboard_token') : null;
  const navigate = useNavigate();
  if (!token) return <Navigate to="/login" replace />;
  // verify token by calling /api/me once and store role and user info
  try {
    api.get('/api/me').then((res) => {
      if (res && res.data) {
        if (res.data.role) {
          localStorage.setItem('dashboard_role', String(res.data.role));
        }
        const name = String(res.data.name || res.data.fullName || res.data.displayName || '').trim()
        if (name) {
          localStorage.setItem('dashboard_user_name', name)
        }
        const email = String(res.data.email || res.data.mail || '').trim()
        if (email) {
          localStorage.setItem('dashboard_user_email', email)
        }
      }
    }).catch(() => {
      localStorage.removeItem('dashboard_token');
      localStorage.removeItem('dashboard_role');
      localStorage.removeItem('dashboard_user_name');
      localStorage.removeItem('dashboard_user_email');
      navigate('/login');
    });
  } catch (e) {
    localStorage.removeItem('dashboard_token');
    localStorage.removeItem('dashboard_role');
    localStorage.removeItem('dashboard_user_name');
    localStorage.removeItem('dashboard_user_email');
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

class ErrorBoundary extends React.Component<{ children?: React.ReactNode }, { hasError: boolean; error?: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: undefined };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    // log to console for now
    console.error('Uncaught render error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6">
          <h2 className="text-xl font-bold">Something went wrong</h2>
          <pre className="mt-4 whitespace-pre-wrap">{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children as any;
  }
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="dashboard-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ErrorBoundary>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<RequireAuth />}>
                <Route path="/" element={<Index />} />
                <Route path="/completed-events" element={<CompletedEvents />} />
                <Route path="/upcoming-events" element={<UpcomingEvents />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/catalog-health" element={<CatalogHealth />} />
                <Route path="/top25-tracks" element={<Top25Tracks />} />
                <Route path="/roadmap" element={<RoadmapPage />} />
                <Route path="/localized-tracks" element={<LocalizedTracksPage />} />
                <Route path="/participant-feedback" element={<ParticipantFeedbackPage />} />
              </Route>
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ErrorBoundary>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
