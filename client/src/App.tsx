import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout/layout";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import VisaServices from "@/pages/visa-services";
import StudyAbroad from "@/pages/study-abroad";
import JapaneseTraining from "@/pages/japanese-training";
import FlightTickets from "@/pages/flight-tickets";
import Login from "@/pages/login";
import Contact from "@/pages/contact";
import ArticleDetail from "@/pages/article-detail";
import { CpanelPage } from "@/pages/cpanel";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/visa-services" component={VisaServices} />
        <Route path="/study-abroad" component={StudyAbroad} />
        <Route path="/japanese-training" component={JapaneseTraining} />
        <Route path="/flight-tickets" component={FlightTickets} />
        <Route path="/login" component={Login} />
        <Route path="/contact" component={Contact} />
        <Route path="/article/:id" component={ArticleDetail} />
        <Route path="/cpanel" component={CpanelPage} />
        {/* Fallback to 404 */}
        <Route component={NotFound} />
      </Switch>
    </Layout>
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
