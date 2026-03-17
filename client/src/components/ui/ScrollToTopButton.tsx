import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";
import type { RefObject } from "react";

interface ScrollToTopButtonProps {
  containerRef?: RefObject<HTMLElement | null>;
  threshold?: number;
  bottomOffsetClassName?: string;
}

export function ScrollToTopButton({
  containerRef,
  threshold = 120,
  bottomOffsetClassName,
}: ScrollToTopButtonProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (containerRef?.current) {
      const target = containerRef.current;
      const onScroll = () => setIsVisible(target.scrollTop > threshold);
      onScroll();
      target.addEventListener("scroll", onScroll, { passive: true });
      return () => target.removeEventListener("scroll", onScroll);
    }

    const onWindowScroll = () => setIsVisible(window.scrollY > threshold);
    onWindowScroll();
    window.addEventListener("scroll", onWindowScroll, { passive: true });
    return () => window.removeEventListener("scroll", onWindowScroll);
  }, [containerRef, threshold]);

  function scrollToTop() {
    if (containerRef?.current) {
      containerRef.current.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <button
      type="button"
      aria-label="맨 위로 이동"
      onClick={scrollToTop}
      className={`fixed right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full border border-surface bg-white text-textMain shadow-sm transition-all ${
        bottomOffsetClassName ?? "bottom-[calc(1rem+var(--ubique-safe-bottom)+10px)]"
      } ${
        isVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      <ArrowUp className="h-7 w-7" />
    </button>
  );
}
