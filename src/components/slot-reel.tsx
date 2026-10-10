"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export interface ReelItem {
  key: string;
  render: () => ReactNode;
}

interface SlotReelProps {
  items: ReelItem[];
  targetKey: string;
  itemWidth?: number;
  duration?: number;
  loops?: number;
  onSettle?: () => void;
  className?: string;
  /** Hide the brass rails / pointer chrome when true. */
  bare?: boolean;
}

/**
 * Slot-machine horizontal reel with brass-rail aesthetic. Slides through items
 * (CSS ease-out cubic) and lands centered on items[targetKey].
 */
export function SlotReel({
  items,
  targetKey,
  itemWidth = 168,
  duration = 3400,
  loops = 4,
  onSettle,
  className = "",
  bare = false,
}: SlotReelProps) {
  const [translate, setTranslate] = useState(0);
  const [phase, setPhase] = useState<"idle" | "spinning" | "settled">("idle");
  const containerRef = useRef<HTMLDivElement>(null);

  const targetIndex = Math.max(0, items.findIndex((i) => i.key === targetKey));
  const finalIndex = loops * items.length + targetIndex;
  const totalRendered = finalIndex + items.length;

  useEffect(() => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.offsetWidth;
    const finalTranslate = -(finalIndex * itemWidth) + (containerWidth / 2 - itemWidth / 2);

    setPhase("spinning");
    requestAnimationFrame(() => setTranslate(finalTranslate));

    const t = setTimeout(() => {
      setPhase("settled");
      onSettle?.();
    }, duration);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  return (
    <div className={`relative w-full max-w-md mx-auto ${className}`}>
      {/* La fenêtre du rouleau : un jour sombre dans la fonte, deux rails
          d'acier, et la goupille (haut et bas) qui marque la pièce tirée. */}
      {!bare && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[3px] rounded-t-[var(--radius)] bg-gradient-to-b from-steel to-steel-dark" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[3px] rounded-b-[var(--radius)] bg-gradient-to-b from-steel to-steel-dark" />
          <div className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2">
            <div className="h-0 w-0 border-x-[10px] border-t-[14px] border-x-transparent border-t-primary drop-shadow-[0_2px_3px_rgba(0,0,0,0.7)]" />
          </div>
          <div className="pointer-events-none absolute bottom-0 left-1/2 z-20 -translate-x-1/2">
            <div className="h-0 w-0 border-x-[10px] border-b-[14px] border-x-transparent border-b-primary drop-shadow-[0_-2px_3px_rgba(0,0,0,0.7)]" />
          </div>
        </>
      )}

      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-gap to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-gap to-transparent" />

      <div
        ref={containerRef}
        className={`relative overflow-hidden rounded-[var(--radius)] ${bare ? "" : "bg-gap shadow-[inset_0_2px_6px_oklch(0_0_0/0.5)]"}`}
        style={{ height: itemWidth + 24 }}
      >
        <div
          className="flex h-full items-center will-change-transform"
          style={{
            transform: `translate3d(${translate}px, 0, 0)`,
            transition:
              phase === "spinning"
                ? `transform ${duration}ms cubic-bezier(0.12, 0.86, 0.18, 1)`
                : "none",
          }}
        >
          {Array.from({ length: totalRendered }, (_, i) => {
            const item = items[i % items.length];
            return (
              <div
                key={i}
                className="flex shrink-0 items-center justify-center"
                style={{ width: itemWidth }}
              >
                {item.render()}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
