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
import OnlineExam from "@/pages/online-exam";
import ExamTaking from "@/pages/exam-taking";
import ExamResult from "@/pages/exam-result";
import Login from "@/pages/login";
import Register from "@/pages/register";
import RegisterSuccess from "@/pages/register-success";
import Contact from "@/pages/contact";
import ArticleDetail from "@/pages/article-detail";
import CreateArticle from "@/pages/create-article";
import EditArticle from "@/pages/edit-article";
import CreateExam from "@/pages/create-exam";
import EditExam from "@/pages/edit-exam";
import { CpanelPage } from "@/pages/cpanel";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/visa-services" component={VisaServices} />
        <Route path="/study-abroad" component={StudyAbroad} />
        <Route path="/japanese-training" component={JapaneseTraining} />
        <Route path="/online-exam" component={OnlineExam} />
        <Route path="/exam/:examId" component={({ params }) => <ExamTaking examId={params.examId} />} />
        <Route path="/exam-result/:attemptId" component={({ params }) => <ExamResult attemptId={params.attemptId} />} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/register-success" component={RegisterSuccess} />
        <Route path="/contact" component={Contact} />
        <Route path="/article/:id" component={ArticleDetail} />
        <Route path="/create-article" component={CreateArticle} />
        <Route path="/edit-article/:id" component={EditArticle} />
        <Route path="/create-exam" component={CreateExam} />
        <Route path="/edit-exam/:examId" component={EditExam} />
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
