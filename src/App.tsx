import { useEffect } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { SpaceBackdrop } from './components/SpaceBackdrop.tsx';
import { Navbar } from './components/Navbar.tsx';
import { Footer } from './components/Footer.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { AboutPage } from './pages/AboutPage.tsx';
import { ExperimentsPage } from './pages/ExperimentsPage.tsx';
import { ExperimentDetailPage } from './pages/ExperimentDetailPage.tsx';
import { RankingPage } from './pages/RankingPage.tsx';
import { PredictionPage } from './pages/PredictionPage.tsx';
import { InsightsPage } from './pages/InsightsPage.tsx';
import { ContactPage } from './pages/ContactPage.tsx';
import { DataLabPage } from './pages/DataLabPage.tsx';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

function NotFoundPage() {
  return (
    <main className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 pt-24 pb-16">
      <div className="editorial-panel max-w-md p-8 text-center">
        <div className="font-mono-data text-[11px] uppercase tracking-[0.22em] text-[#D97B29]">
          404 — Orbit Out of Bounds
        </div>
        <h1 className="font-serif-display mt-3 text-3xl font-normal text-[#F3EFE8]">
          Page Not <span className="italic text-[#D97B29]">Found</span>
        </h1>
        <p className="mt-3 text-sm text-[#C2BCB2]">
          The requested mission route does not exist in Flame in Freefall.
        </p>
        <Link
          to="/"
          className="mt-7 inline-flex items-center gap-2.5 border border-[#D97B29]/75 bg-[#D97B29]/10 px-6 py-2.5 text-[11px] font-medium uppercase tracking-[0.2em] text-[#E68A38] transition-colors hover:bg-[#D97B29] hover:text-[#060607]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Return Home</span>
        </Link>
      </div>
    </main>
  );
}

function AppShell() {
  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#060607] text-[#F3EFE8]">
      <SpaceBackdrop />
      <Navbar />
      <ScrollToTop />

      <div className="relative z-10 flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/experiments" element={<ExperimentsPage />} />
          <Route path="/experiments/:slug" element={<ExperimentDetailPage />} />
          <Route path="/ranking" element={<RankingPage />} />
          <Route path="/prediction" element={<PredictionPage />} />
          <Route path="/data-lab" element={<DataLabPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>

      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
