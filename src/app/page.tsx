"use client";

import dynamic from "next/dynamic";

// ClientApp uses react-router's HashRouter, which touches browser-only
// APIs during render. Loading it with ssr:false keeps it out of the
// server-side prerender entirely, so it only mounts in the browser.
const ClientApp = dynamic(() => import("@/app/ClientApp"), { ssr: false });

export default function Page() {
  return <ClientApp />;
}
