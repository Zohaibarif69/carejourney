"use client";

import { HashRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/context/AppContext";
import Layout from "@/components/Layout";
import HomePage from "@/pages/HomePage";
import SearchPage from "@/pages/SearchPage";
import ProviderPage from "@/pages/ProviderPage";
import VisualPage from "@/pages/VisualPage";
import JourneyNewPage from "@/pages/JourneyNewPage";
import JourneyDashboardPage from "@/pages/JourneyDashboardPage";
import JourneyDocumentsPage from "@/pages/JourneyDocumentsPage";
import JourneyConsultationPage from "@/pages/JourneyConsultationPage";
import JourneyRequestPage from "@/pages/JourneyRequestPage";
import FoxitAgentPage from "@/pages/FoxitAgentPage";
import ProfilePage from "@/pages/ProfilePage";

export default function ClientApp() {
  return (
    <HashRouter>
      <AppProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/providers/:id" element={<ProviderPage />} />
            <Route path="/visual" element={<VisualPage />} />
            <Route path="/journey/new" element={<JourneyNewPage />} />
            <Route path="/journey/:id" element={<JourneyDashboardPage />} />
            <Route path="/journey/:id/documents" element={<JourneyDocumentsPage />} />
            <Route path="/journey/:id/consultation" element={<JourneyConsultationPage />} />
            <Route path="/journey/:id/request" element={<JourneyRequestPage />} />
            <Route path="/journey/:id/agent" element={<FoxitAgentPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </Layout>
      </AppProvider>
    </HashRouter>
  );
}
