import { render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { useGoatHops } from './useGoatHops';

// jsdom has no layout: each goat's position comes from its data-y / data-x attributes.
function Board({
  change,
  goats,
}: {
  change: number;
  goats: { id: string; step: string; y: number; x?: number }[];
}) {
  const board = useRef<HTMLDivElement>(null);
  useGoatHops(board, change);
  return (
    <div ref={board}>
      {goats.map((g) => (
        <span key={g.id} data-goat={g.id} data-step={g.step} data-x={g.x ?? 0} data-y={g.y} />
      ))}
    </div>
  );
}

const animate = vi.fn();
function setup(reduced = false) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement
  ) {
    const x = Number(this.dataset.x ?? 0);
    const y = Number(this.dataset.y ?? 0);
    return {
      left: x,
      top: y,
      width: 0,
      height: 0,
      right: x,
      bottom: y,
      x,
      y,
      toJSON: () => ({}),
    } as DOMRect;
  });
  Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  animate.mockClear();
});

it('hops a goat that climbed to a new ledge and slides one only nudged by layout', () => {
  setup();
  const { rerender } = render(
    <Board
      change={1}
      goats={[
        { id: 'red@7', step: 'foot', y: 300 },
        { id: 'blue@7', step: 'foot', y: 300, x: 40 },
      ]}
    />
  );
  expect(animate).not.toHaveBeenCalled();
  rerender(
    <Board
      change={2}
      goats={[
        { id: 'red@7', step: '2', y: 200 },
        { id: 'blue@7', step: 'foot', y: 300, x: 20 },
      ]}
    />
  );
  const durations = animate.mock.calls.map(([, timing]) => timing.duration);
  expect(durations.sort()).toEqual([260, 620]); // blue slides, red hops
});

it('tumbles a goat knocked down and ignores re-renders without a game change', () => {
  setup();
  const { rerender } = render(<Board change={1} goats={[{ id: 'red@7', step: '0', y: 100 }]} />);
  rerender(<Board change={1} goats={[{ id: 'red@7', step: 'foot', y: 300 }]} />);
  expect(animate).not.toHaveBeenCalled();
  rerender(<Board change={2} goats={[{ id: 'red@7', step: 'foot', y: 300 }]} />);
  expect(animate).not.toHaveBeenCalled(); // nothing moved since the last measurement
  rerender(<Board change={3} goats={[{ id: 'red@7', step: '0', y: 100 }]} />);
  rerender(<Board change={4} goats={[{ id: 'red@7', step: 'foot', y: 300 }]} />);
  expect(animate.mock.calls.map(([, t]) => t.duration)).toEqual([620, 760]);
});

it('stays still for people who prefer reduced motion', () => {
  setup(true);
  const { rerender } = render(<Board change={1} goats={[{ id: 'red@7', step: 'foot', y: 300 }]} />);
  rerender(<Board change={2} goats={[{ id: 'red@7', step: '1', y: 200 }]} />);
  expect(animate).not.toHaveBeenCalled();
});
