import { type RefObject, useLayoutEffect, useRef } from 'react';

type Places = Map<string, { x: number; y: number; step?: string }>;

function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Centre of every goat (`data-goat="<stable id>"`), relative to the board so scrolling never counts as movement. */
function measure(root: HTMLElement): Places {
  const origin = root.getBoundingClientRect();
  const places: Places = new Map();
  for (const el of root.querySelectorAll<HTMLElement>('[data-goat]')) {
    const r = el.getBoundingClientRect();
    places.set(el.dataset.goat as string, {
      x: r.left - origin.left + r.width / 2,
      y: r.top - origin.top + r.height / 2,
      step: el.dataset.step,
    });
  }
  return places;
}

/**
 * Animate goats that moved since the previous game change (FLIP): each moved goat
 * is drawn back at its old spot, then hops along an arc to the new one and lands
 * with a squash. A goat that drops (knocked off a summit) tumbles down instead.
 *
 * Give every goat element a `data-goat` id that stays the same while it climbs
 * (e.g. `red@7`) and a `data-step` naming its ledge (e.g. `foot`, `2`). Only a
 * goat whose ledge changed hops; one nudged by layout (a neighbour leaving the
 * foot) just slides. `change` identifies the game state; re-renders that do not
 * change it (resizing, typing) only re-measure. Honours prefers-reduced-motion.
 */
export function useGoatHops(board: RefObject<HTMLElement | null>, change: unknown): void {
  const last = useRef<{ change: unknown; places: Places } | null>(null);
  useLayoutEffect(() => {
    const root = board.current;
    if (!root) return;
    const places = measure(root);
    const previous = last.current;
    last.current = { change, places };
    if (!previous || previous.change === change || reducedMotion()) return;
    for (const el of root.querySelectorAll<HTMLElement>('[data-goat]')) {
      const id = el.dataset.goat as string;
      const from = previous.places.get(id);
      const to = places.get(id);
      if (!from || !to || typeof el.animate !== 'function') continue;
      const dx = from.x - to.x;
      const dy = from.y - to.y;
      if (Math.hypot(dx, dy) < 6) continue;
      const start = `translate(${dx}px, ${dy}px)`;
      if (from.step === to.step) {
        el.animate([{ transform: start }, { transform: 'translate(0, 0)' }], {
          duration: 260,
          easing: 'ease-out',
        });
      } else if (dy >= 0) {
        // Climbing (or sideways): leap up past the target, stretch in the air, squash on landing.
        const rise = Math.min(70, 26 + Math.abs(dy) * 0.5);
        el.animate(
          [
            { transform: `${start} scale(1)`, offset: 0 },
            { transform: `${start} scale(1.12, 0.85)`, offset: 0.12 },
            {
              transform: `translate(${dx * 0.45}px, ${dy * 0.45 - rise}px) scale(0.9, 1.15)`,
              offset: 0.5,
            },
            { transform: 'translate(0, 0) scale(1.18, 0.8)', offset: 0.84 },
            { transform: 'translate(0, 0) scale(1)', offset: 1 },
          ],
          { duration: 620, easing: 'cubic-bezier(0.33, 0, 0.25, 1)' }
        );
      } else {
        // Knocked off: a small hop up, then a tumbling fall to the foot.
        el.animate(
          [
            { transform: `${start} rotate(0deg)`, offset: 0 },
            { transform: `translate(${dx * 0.85}px, ${dy - 22}px) rotate(-40deg)`, offset: 0.25 },
            { transform: 'translate(0, 0) rotate(-340deg)', offset: 0.85 },
            { transform: 'translate(0, -6px) rotate(-360deg)', offset: 0.93 },
            { transform: 'translate(0, 0) rotate(-360deg)', offset: 1 },
          ],
          { duration: 760, easing: 'cubic-bezier(0.45, 0, 0.6, 1)' }
        );
      }
    }
  });
}
