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

import Contact from "@/pages/contact";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/visa-services" component={VisaServices} />
        <Route path="/study-abroad" component={StudyAbroad} />
        <Route path="/japanese-training" component={JapaneseTraining} />
        <Route path="/flight-tickets" component={FlightTickets} />

        <Route path="/contact" component={Contact} />
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
