import { useAuth } from "@clerk/react";
import { useEffect, useRef } from "react";
import { Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import UploadPage from "./pages/UploadPage";
import ReportsPage from "./pages/ReportsPage";
import ReportPage from "./pages/ReportPage";
import SharedReportPage from "./pages/SharedReportPage";
import ReviewerQueuePage from "./pages/ReviewerQueuePage";
import ReviewPage from "./pages/ReviewPage";
import AdminPage from "./pages/AdminPage";
import ProfilePage from "./pages/ProfilePage";
import NotFound from "./pages/NotFound";

function SessionTimeout() {
  const { isSignedIn, signOut } = useAuth();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutMs = 30 * 60 * 1000;

  useEffect(() => {
    if (!isSignedIn) return;
    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void signOut({ redirectUrl: "/sign-in" });
      }, timeoutMs);
    };
    const events = ["pointerdown", "keydown", "touchstart", "scroll"];
    events.forEach(event => window.addEventListener(event, reset, { passive: true }));
    reset();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach(event => window.removeEventListener(event, reset));
    };
  }, [isSignedIn, signOut]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/sign-in"><AuthPage mode="sign-in" /></Route>
      <Route path="/sign-up"><AuthPage mode="sign-up" /></Route>
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/upload" component={UploadPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/reports/:id" component={ReportPage} />
      <Route path="/shared-report/:token" component={SharedReportPage} />
      <Route path="/review" component={ReviewerQueuePage} />
      <Route path="/review/:id" component={ReviewPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <SessionTimeout />
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
