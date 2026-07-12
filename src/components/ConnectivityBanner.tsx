import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export default function ConnectivityBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const markOnline = () => setOnline(true);
    const markOffline = () => setOnline(false);
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    return () => {
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-error-container px-4 py-2 text-sm font-semibold text-on-error-container" role="status">
      <WifiOff className="h-4 w-4" aria-hidden="true" />
      You are offline. Ledger reads may be stale and write actions will fail safely.
    </div>
  );
}
