import { useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';

type WorldModule = { default: unknown };

/**
 * Mounts a 3D world. The engine (three.js + canvas textures) only exists in the browser,
 * so it is loaded lazily inside the effect and never runs during prerendering.
 */
export function WorldStage({ load }: { load: () => Promise<WorldModule> }) {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;
    document.documentElement.classList.add('in-world');
    Promise.all([import('../kit/stage.js'), load()]).then(([{ createStage }, world]) => {
      if (cancelled || !ref.current) return;
      dispose = createStage(world.default, ref.current, { onHome: () => navigate({ to: '/' }) });
    });
    return () => {
      cancelled = true;
      dispose?.();
      document.documentElement.classList.remove('in-world');
    };
  }, [load, navigate]);

  return <div ref={ref} className="world-root" />;
}
