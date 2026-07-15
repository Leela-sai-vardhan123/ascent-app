import dynamic from "next/dynamic";

// Loaded client-side only, since the app uses browser-only APIs
// (localStorage, window, clipboard).
const AscentApp = dynamic(() => import("../components/AscentApp"), { ssr: false });

export default function Home() {
  return <AscentApp />;
}
