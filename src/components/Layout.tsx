import { type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const inJourney = /^\/journey\/[^/]+/.test(location.pathname);

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Navbar />
      {inJourney ? (
        <div className="flex flex-1 overflow-hidden">
          <div className="hidden md:flex">
            <Sidebar />
          </div>
          <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
            {children}
          </main>
        </div>
      ) : (
        <main className="flex-1 pb-20 md:pb-0">
          {children}
        </main>
      )}
    </div>
  );
}
