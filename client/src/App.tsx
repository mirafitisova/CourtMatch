import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import FindPlayers from "@/pages/FindPlayers";
import Requests from "@/pages/Requests";
import ProfileSetup from "@/pages/ProfileSetup";
import Onboarding from "@/pages/Onboarding";
import AuthPage from "@/pages/AuthPage";
import SignupPage from "@/pages/SignupPage";
import SignupSuccess from "@/pages/SignupSuccess";
import SafetyGuidelines from "@/pages/SafetyGuidelines";
import ParentApprovePage from "@/pages/ParentApprovePage";
import CourtsAdmin from "@/pages/admin/CourtsAdmin";

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center text-primary">Loading...</div>;
  }

  return (
    <Switch>
      <Route path="/" component={user ? Dashboard : Landing} />
      <Route path="/dashboard" component={user ? Dashboard : Landing} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/safety-guidelines" component={SafetyGuidelines} />
      <Route path="/signup/success" component={SignupSuccess} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/players" component={FindPlayers} />
      <Route path="/requests" component={Requests} />
      <Route path="/profile-setup" component={ProfileSetup} />
      <Route path="/profile" component={ProfileSetup} />
      <Route path="/parent-approve/:token" component={ParentApprovePage} />
      <Route path="/admin/courts" component={CourtsAdmin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
