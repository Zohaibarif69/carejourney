"use client";

import { HashRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/context/AppContext";
import Layout from "@/components/Layout";
import HomePage from "@/spa-views/HomePage";
import SearchPage from "@/spa-views/SearchPage";
import ProviderPage from "@/spa-views/ProviderPage";
import VisualPage from "@/spa-views/VisualPage";
import JourneyNewPage from "@/spa-views/JourneyNewPage";
import JourneyDashboardPage from "@/spa-views/JourneyDashboardPage";
import JourneyDocumentsPage from "@/spa-views/JourneyDocumentsPage";
import JourneyConsultationPage from "@/spa-views/JourneyConsultationPage";
import JourneyRequestPage from "@/spa-views/JourneyRequestPage";
import FoxitAgentPage from "@/spa-views/FoxitAgentPage";
import ProfilePage from "@/spa-views/ProfilePage";

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
