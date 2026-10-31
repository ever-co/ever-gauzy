import { isWindowPosition, overlapArea, restoreWindowPosition } from './window-position';

/**
 * The mini timer goes back where the user left it (#7683), as long as that spot is still on a connected display.
 */
describe('restoreWindowPosition', () => {
	const primary = { x: 0, y: 0, width: 1920, height: 1080 };
	const right = { x: 1920, y: 0, width: 2560, height: 1440 };
	const widget = { width: 60, height: 110 };

	it('keeps a position that is whole on a display', () => {
		expect(restoreWindowPosition({ x: 800, y: 300 }, widget, [primary])).toEqual({ x: 800, y: 300 });
	});

	it('keeps a position on a second display, including one left of the primary display (negative x)', () => {
		const left = { x: -1280, y: 0, width: 1280, height: 1024 };

		expect(restoreWindowPosition({ x: 2500, y: 900 }, widget, [primary, right])).toEqual({ x: 2500, y: 900 });
		expect(restoreWindowPosition({ x: -1000, y: 40 }, widget, [left, primary])).toEqual({ x: -1000, y: 40 });
	});

	it('moves a window left partly off-screen just enough to be whole on its display', () => {
		// Half past the right edge, and below the bottom of the primary display
		expect(restoreWindowPosition({ x: 1890, y: 1050 }, widget, [primary])).toEqual({
			x: 1920 - 60,
			y: 1080 - 110
		});
		// Past the top-left corner
		expect(restoreWindowPosition({ x: -20, y: -50 }, widget, [primary])).toEqual({ x: 0, y: 0 });
	});

	it('puts a window that straddles two displays on the one it overlaps the most', () => {
		// 40 of its 60 px are on the right display
		expect(restoreWindowPosition({ x: 1900, y: 500 }, widget, [primary, right])).toEqual({ x: 1920, y: 500 });
		// 40 of its 60 px are on the primary display
		expect(restoreWindowPosition({ x: 1880, y: 500 }, widget, [primary, right])).toEqual({ x: 1860, y: 500 });
	});

	it('has no position when the display it was on is disconnected', () => {
		expect(restoreWindowPosition({ x: 2500, y: 900 }, widget, [primary])).toBeNull();
	});

	it('has no position when it is on no display at all, or when there is no display', () => {
		expect(restoreWindowPosition({ x: 5000, y: -3000 }, widget, [primary, right])).toBeNull();
		expect(restoreWindowPosition({ x: 100, y: 100 }, widget, [])).toBeNull();
	});

	it('moves onto a display that got smaller than where it was left', () => {
		const smaller = { x: 0, y: 0, width: 1366, height: 768 };

		expect(restoreWindowPosition({ x: 1340, y: 700 }, widget, [smaller])).toEqual({ x: 1366 - 60, y: 768 - 110 });
	});

	it('aligns a window larger than the display to its top-left corner', () => {
		const tiny = { x: 100, y: 50, width: 40, height: 40 };

		expect(restoreWindowPosition({ x: 90, y: 40 }, widget, [tiny])).toEqual({ x: 100, y: 50 });
	});

	it('rounds a fractional position (scaled displays)', () => {
		expect(restoreWindowPosition({ x: 100.6, y: 200.2 }, widget, [primary])).toEqual({ x: 101, y: 200 });
	});

	it('has no position for a damaged stored value', () => {
		for (const saved of [null, undefined, {}, { x: '10', y: 10 }, { x: Number.NaN, y: 0 }, { x: 1, y: Infinity }]) {
			expect(restoreWindowPosition(saved as any, widget, [primary])).toBeNull();
		}
	});
});

describe('overlapArea', () => {
	it('is the shared area, and 0 for rectangles that only touch or are apart', () => {
		const a = { x: 0, y: 0, width: 100, height: 100 };

		expect(overlapArea(a, { x: 50, y: 50, width: 100, height: 100 })).toBe(2500);
		expect(overlapArea(a, { x: 100, y: 0, width: 100, height: 100 })).toBe(0);
		expect(overlapArea(a, { x: 300, y: 300, width: 10, height: 10 })).toBe(0);
	});
});

describe('isWindowPosition', () => {
	it('accepts two finite numbers only', () => {
		expect(isWindowPosition({ x: 0, y: -10 })).toBe(true);
		expect(isWindowPosition({ x: 0 })).toBe(false);
		expect(isWindowPosition('0,0')).toBe(false);
		expect(isWindowPosition(null)).toBe(false);
	});
});
