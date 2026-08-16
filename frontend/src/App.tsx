import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout/layout";
import { PortalProvider } from "@/contexts/PortalContext";
import { PortalRouteGuard } from "@/components/PortalRouteGuard";

import NotFound from "@/pages/not-found";
import PortalHome, {
  RedirectJapaneseTrainingToHome,
} from "@/pages/portal-home";
import Login from "@/pages/login";

const VisaServices = lazy(() => import("@/pages/visa-services"));
const StudyAbroad = lazy(() => import("@/pages/study-abroad"));
const ClassesPage = lazy(() => import("@/pages/classes"));
const ClassDetailPage = lazy(() => import("@/pages/class-detail"));
const CartPage = lazy(() => import("@/pages/cart"));
const CheckoutPage = lazy(() => import("@/pages/checkout"));
const CheckoutSuccessPage = lazy(() => import("@/pages/checkout-success"));
const CheckoutCancelPage = lazy(() => import("@/pages/checkout-cancel"));
const OnlineExam = lazy(() => import("@/pages/online-exam"));
const ExamTaking = lazy(() => import("@/pages/exam-taking"));
const ExamResult = lazy(() => import("@/pages/exam-result"));
const Register = lazy(() => import("@/pages/register"));
const RegisterSuccess = lazy(() => import("@/pages/register-success"));
const Contact = lazy(() => import("@/pages/contact"));
const ArticleDetail = lazy(() => import("@/pages/article-detail"));
const CreateArticle = lazy(() => import("@/pages/create-article"));
const EditArticle = lazy(() => import("@/pages/edit-article"));
const CreateExam = lazy(() => import("@/pages/create-exam"));
const EditExam = lazy(() => import("@/pages/edit-exam"));
const ManageQuestions = lazy(() => import("@/pages/manage-questions"));
const ExamAttemptsPage = lazy(() => import("@/pages/exam-attempts"));
const CertificatePage = lazy(() => import("@/pages/certificate"));
const CpanelPage = lazy(() => import("@/pages/cpanel"));
const LegacyCompanyHome = lazy(() => import("@/pages/home"));
const PortalSectionRoute = lazy(() =>
  import("@/pages/portal-section-routes").then((m) => ({
    default: m.PortalSectionRoute,
  })),
);
const PortalNewsRoute = lazy(() =>
  import("@/pages/portal-section-routes").then((m) => ({
    default: m.PortalNewsRoute,
  })),
);

function PageFallback() {
  return (
    <>
      <div className="route-progress" aria-hidden />
      <div
        className="page-loading-shell"
        role="status"
        aria-live="polite"
        aria-label="Đang tải trang"
      >
        <div className="page-loading-hero" />
        <div className="page-loading-row">
          <div className="page-loading-card" />
          <div className="page-loading-card" />
          <div className="page-loading-card" />
        </div>
        <p className="sr-only">Đang tải...</p>
      </div>
    </>
  );
}

function Router() {
  return (
    <Layout>
      <Suspense fallback={<PageFallback />}>
        <Switch>
          <Route path="/" component={PortalHome} />
          <Route path="/company" component={LegacyCompanyHome} />
          <Route path="/visa-services" component={VisaServices} />
          <Route path="/study-abroad" component={StudyAbroad} />
          <Route
            path="/japanese-training"
            component={RedirectJapaneseTrainingToHome}
          />
          <Route path="/classes" component={ClassesPage} />
          <Route
            path="/classes/:id"
            component={({ params }) => <ClassDetailPage id={params.id} />}
          />
          <Route path="/cart" component={CartPage} />
          <Route path="/checkout" component={CheckoutPage} />
          <Route path="/checkout/success" component={CheckoutSuccessPage} />
          <Route path="/checkout/cancel" component={CheckoutCancelPage} />
          <Route path="/online-exam" component={OnlineExam} />
          <Route
            path="/exam/:examId"
            component={({ params }) => <ExamTaking examId={params.examId} />}
          />
          <Route
            path="/exam-result/:attemptId"
            component={({ params }) => (
              <ExamResult attemptId={params.attemptId} />
            )}
          />
          <Route
            path="/certificate/:attemptId"
            component={({ params }) => (
              <CertificatePage attemptId={params.attemptId} />
            )}
          />
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />
          <Route path="/register-success" component={RegisterSuccess} />
          <Route path="/contact" component={Contact} />
          <Route path="/news" component={PortalNewsRoute} />
          <Route
            path="/countries"
            component={() => <PortalSectionRoute slug="countries" />}
          />
          <Route
            path="/schools"
            component={() => <PortalSectionRoute slug="schools" />}
          />
          <Route
            path="/costs"
            component={() => <PortalSectionRoute slug="costs" />}
          />
          <Route
            path="/documents"
            component={() => <PortalSectionRoute slug="documents" />}
          />
          <Route
            path="/faq"
            component={() => <PortalSectionRoute slug="faq" />}
          />
          <Route
            path="/courses"
            component={() => <PortalSectionRoute slug="courses" />}
          />
          <Route
            path="/schedule"
            component={() => <PortalSectionRoute slug="schedule" />}
          />
          <Route
            path="/enterprise"
            component={() => <PortalSectionRoute slug="enterprise" />}
          />
          <Route path="/article/:id" component={ArticleDetail} />
          <Route path="/create-article" component={CreateArticle} />
          <Route path="/edit-article/:id" component={EditArticle} />
          <Route path="/create-exam" component={CreateExam} />
          <Route path="/edit-exam/:examId" component={EditExam} />
          <Route
            path="/exam-attempts/:examId"
            component={({ params }) => (
              <ExamAttemptsPage examId={params.examId} />
            )}
          />
          <Route path="/manage/questions" component={ManageQuestions} />
          <Route path="/cpanel" component={CpanelPage} />
          <Route
            path="/cpanel/:tab"
            component={({ params }) => <CpanelPage tab={params.tab} />}
          />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PortalProvider>
          <Toaster />
          <PortalRouteGuard>
            <Router />
          </PortalRouteGuard>
        </PortalProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
