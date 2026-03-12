import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { SessionProvider } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    const start = () => {
      clearTimer();
      setIsRouteLoading(true);
      setProgress(12);
      timerRef.current = setInterval(() => {
        setProgress((prev) => Math.min(prev + Math.max(1, (94 - prev) * 0.08), 94));
      }, 120);
    };

    const end = () => {
      clearTimer();
      setProgress(100);
      setTimeout(() => {
        setIsRouteLoading(false);
        setProgress(0);
      }, 180);
    };

    router.events.on("routeChangeStart", start);
    router.events.on("routeChangeComplete", end);
    router.events.on("routeChangeError", end);

    return () => {
      clearTimer();
      router.events.off("routeChangeStart", start);
      router.events.off("routeChangeComplete", end);
      router.events.off("routeChangeError", end);
    };
  }, [router.events]);

  return (
    <SessionProvider session={pageProps.session}>
      <div
        aria-hidden
        className={`pointer-events-none fixed left-0 top-0 z-[9999] h-1 bg-primary transition-[opacity,transform] duration-200 ${
          isRouteLoading ? "opacity-100" : "opacity-0"
        }`}
        style={{
          width: `${progress}%`,
          boxShadow: "0 0 10px rgba(58, 138, 249, 0.55)",
        }}
      />
      <Component {...pageProps} />
    </SessionProvider>
  );
}
