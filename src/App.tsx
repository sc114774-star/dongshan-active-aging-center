import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Router, Route, Switch, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";

import SiteLayout from "@/components/SiteLayout";

import Home from "@/pages/Home";
import Gallery from "@/pages/Gallery";
import CalendarPage from "@/pages/Calendar";
import Reflections from "@/pages/Reflections";
import Admin from "@/pages/Admin";
import QuickUpload from "@/pages/QuickUpload";
import NotFound from "@/pages/NotFound";

function Routes() {
  const [location] = useLocation();

  // 快速上傳頁：全螢幕、不套用網站導覽列／頁尾
  if (location.startsWith("/upload")) return <QuickUpload />;

  return (
    <SiteLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/gallery" component={Gallery} />
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/reflections" component={Reflections} />
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
    </SiteLayout>
  );
}

function AppRouter() {
  return (
    <Router hook={useHashLocation}>
      <Routes />
    </Router>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <AppRouter />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
