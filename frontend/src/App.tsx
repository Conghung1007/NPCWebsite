import { Switch, Route, Router as WouterRouter } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout/layout";
import { PortalProvider } from "@/contexts/PortalContext";
import { PortalRouteGuard } from "@/components/PortalRouteGuard";
import { DeployChunkErrorBoundary } from "@/components/DeployChunkErrorBoundary";
import { ExamReturnTracker } from "@/components/ExamReturnTracker";
import { usePortalLocation } from "@/lib/usePortalLocation";

import NotFound from "@/pages/not-found";
import PortalHome from "@/pages/portal-home";
import Login from "@/pages/login";

const RedirectToTnjs = lazy(() =>
  import("@/pages/redirect-tnjs").then((m) => ({ default: m.RedirectToTnjs })),
);
const ClassesPage = lazy(() => import("@/pages/classes"));
const ClassDetailPage = lazy(() => import("@/pages/class-detail"));
const CartPage = lazy(() => import("@/pages/cart"));
const CheckoutPage = lazy(() => import("@/pages/checkout"));
const CheckoutSuccessPage = lazy(() => import("@/pages/checkout-success"));
const CheckoutCancelPage = lazy(() => import("@/pages/checkout-cancel"));
const OnlineExam = lazy(() => import("@/pages/online-exam-route"));
const ExamTaking = lazy(() => import("@/pages/exam-taking"));
const ExamResult = lazy(() => import("@/pages/exam-result"));
const Register = lazy(() => import("@/pages/register"));
const RegisterSuccess = lazy(() => import("@/pages/register-success"));
const ForgotPassword = lazy(() => import("@/pages/forgot-password"));
const ArticleDetail = lazy(() => import("@/pages/article-detail"));
const CreateArticle = lazy(() => import("@/pages/create-article"));
const EditArticle = lazy(() => import("@/pages/edit-article"));
const CreateExam = lazy(() => import("@/pages/create-exam"));
const EditExam = lazy(() => import("@/pages/edit-exam"));
const ManageQuestions = lazy(() => import("@/pages/manage-questions"));
const ExamAttemptsPage = lazy(() => import("@/pages/exam-attempts"));
const CertificatePage = lazy(() => import("@/pages/certificate"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const CpanelPage = lazy(() => import("@/pages/cpanel"));
const CompanyRedirect = lazy(() => import("@/pages/company-redirect"));
const BlockStaticPage = lazy(() =>
  import("@/components/BlockStaticPage").then((m) => ({
    default: m.BlockStaticPage,
  })),
);
const BlockSectionPage = lazy(() =>
  import("@/pages/block-marketing-routes").then((m) => ({
    default: m.BlockSectionPage,
  })),
);
const BlockContactPage = lazy(() =>
  import("@/pages/block-marketing-routes").then((m) => ({
    default: m.BlockContactPage,
  })),
);
const BlockNewsPage = lazy(() =>
  import("@/pages/block-marketing-routes").then((m) => ({
    default: m.BlockNewsPage,
  })),
);
const LegacyMarketingRedirect = lazy(() =>
  import("@/pages/block-marketing-routes").then((m) => ({
    default: m.LegacyMarketingRedirect,
  })),
);
const DynamicBlockPage = lazy(() => import("@/pages/dynamic-block-page"));

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
          <Route path="/company" component={CompanyRedirect} />
          <Route
            path="/visa-services"
            component={() => (
              <BlockStaticPage
                layoutKey="visa-services"
                portal="huongnghiep"
                label="Dịch vụ visa"
                canonicalPath="/huong-nghiep/visa-services"
                seoDescription="Dịch vụ visa Nhật Bản tại Trí Nhân Academy — tư vấn hồ sơ và lộ trình rõ ràng."
              />
            )}
          />
          <Route
            path="/study-abroad"
            component={() => <LegacyMarketingRedirect fromPath="/study-abroad" />}
          />
          <Route path="/japanese-training" component={RedirectToTnjs} />
          <Route
            path="/du-hoc"
            component={() => <BlockSectionPage slug="du-hoc" />}
          />
          <Route
            path="/di-lam"
            component={() => <BlockSectionPage slug="di-lam" />}
          />
          <Route
            path="/dao-tao-nghe"
            component={() => <BlockSectionPage slug="dao-tao-nghe" />}
          />
          <Route
            path="/bien-phien-dich"
            component={() => <BlockSectionPage slug="bien-phien-dich" />}
          />
          <Route
            path="/ky-nang-mem"
            component={() => <BlockSectionPage slug="ky-nang-mem" />}
          />
          <Route
            path="/tu-van-doanh-nghiep"
            component={() => <BlockSectionPage slug="tu-van-doanh-nghiep" />}
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
          <Route path="/forgot-password" component={ForgotPassword} />
          <Route
            path="/profile/:tab"
            component={({ params }) => <ProfilePage tab={params.tab} />}
          />
          <Route path="/profile" component={() => <ProfilePage />} />
          <Route path="/contact" component={BlockContactPage} />
          <Route path="/news" component={BlockNewsPage} />
          <Route
            path="/countries"
            component={() => <LegacyMarketingRedirect fromPath="/countries" />}
          />
          <Route
            path="/schools"
            component={() => <LegacyMarketingRedirect fromPath="/schools" />}
          />
          <Route
            path="/costs"
            component={() => <LegacyMarketingRedirect fromPath="/costs" />}
          />
          <Route
            path="/documents"
            component={() => <LegacyMarketingRedirect fromPath="/documents" />}
          />
          <Route
            path="/faq"
            component={() => <LegacyMarketingRedirect fromPath="/faq" />}
          />
          <Route
            path="/courses"
            component={() => <LegacyMarketingRedirect fromPath="/courses" />}
          />
          <Route
            path="/schedule"
            component={() => <LegacyMarketingRedirect fromPath="/schedule" />}
          />
          <Route
            path="/enterprise"
            component={() => <LegacyMarketingRedirect fromPath="/enterprise" />}
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
          <Route path="/:slug" component={DynamicBlockPage} />
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
        <WouterRouter hook={usePortalLocation}>
          <PortalProvider>
            <ExamReturnTracker />
            <Toaster />
            <DeployChunkErrorBoundary fallback={<PageFallback />}>
              <PortalRouteGuard>
                <Router />
              </PortalRouteGuard>
            </DeployChunkErrorBoundary>
          </PortalProvider>
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
