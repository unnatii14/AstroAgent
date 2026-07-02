import { useMemo } from "react";

// Decorative night sky: ~110 twinkling stars + three slowly drifting gold
// nebula wisps (pure CSS animation, no images). useMemo keeps positions
// stable across re-renders so the sky doesn't "jump".
export default function StarField() {
  const stars = useMemo(
    () =>
      Array.from({ length: 110 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: Math.random() < 0.85 ? 1 + Math.random() : 2 + Math.random() * 1.5,
        delay: Math.random() * 6,
        duration: 3 + Math.random() * 5,
      })),
    []
  );

  return (
    <div className="starfield" aria-hidden="true">
      <div className="nebula nebula-1" />
      <div className="nebula nebula-2" />
      <div className="nebula nebula-3" />
      {stars.map((s) => (
        <span
          key={s.id}
          className="star"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
