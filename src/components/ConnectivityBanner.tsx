import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";

/** Offline notice, plus a brief "back online" confirmation so the change is announced. */
export default function ConnectivityBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    const markOnline = () => {
      setOnline(true);
      setJustReconnected(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setJustReconnected(false), 4000);
    };
    const markOffline = () => {
      setOnline(false);
      setJustReconnected(false);
    };
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    return () => {
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
      window.clearTimeout(timer);
    };
  }, []);

  if (online && !justReconnected) return null;

  return (
    <div
      className={
        online
          ? "flex items-center justify-center gap-2 bg-primary-fixed px-4 py-2 text-sm font-semibold text-primary"
          : "flex items-center justify-center gap-2 bg-error-container px-4 py-2 text-sm font-semibold text-on-error-container"
      }
      role="status"
      aria-live="polite"
    >
      {online ? <Wifi className="h-4 w-4" aria-hidden="true" /> : <WifiOff className="h-4 w-4" aria-hidden="true" />}
      {online
        ? "Back online."
        : "You are offline. You can read elections, but you cannot vote, delegate or nullify until the connection returns."}
    </div>
  );
}
