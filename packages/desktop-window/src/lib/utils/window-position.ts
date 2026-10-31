import type { IWindowPosition } from '@gauzy/desktop-core';

/** A rectangle in screen coordinates (DIP), as Electron reports display bounds. */
export interface IScreenRectangle {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** The size of a window (DIP). */
export interface IWindowSize {
	width: number;
	height: number;
}

/** Whether a stored value is a usable position: two finite numbers. */
export function isWindowPosition(value: unknown): value is IWindowPosition {
	const point = value as IWindowPosition;
	return !!point && typeof point === 'object' && Number.isFinite(point.x) && Number.isFinite(point.y);
}

/** The area two rectangles share, `0` when they do not overlap. */
export function overlapArea(a: IScreenRectangle, b: IScreenRectangle): number {
	const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
	const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
	return width > 0 && height > 0 ? width * height : 0;
}

/**
 * Where a window saved at `saved` goes back to on the displays connected now.
 *
 * The window returns to the display it overlaps the most, moved just enough to be whole on it (a display that got
 * smaller, a window left half off-screen). When it overlaps none (its display was disconnected, or the displays were
 * re-arranged far from it) there is no position to restore: `null`, and the caller keeps its default placement.
 *
 * @param saved Where the window's top-left corner was.
 * @param size The window's size now.
 * @param displays The bounds of the connected displays.
 */
export function restoreWindowPosition(
	saved: IWindowPosition,
	size: IWindowSize,
	displays: readonly IScreenRectangle[]
): IWindowPosition | null {
	if (!isWindowPosition(saved)) {
		return null;
	}
	const window: IScreenRectangle = { x: saved.x, y: saved.y, width: size.width, height: size.height };

	let best: IScreenRectangle | null = null;
	let bestArea = 0;
	for (const display of displays) {
		const area = overlapArea(window, display);
		if (area > bestArea) {
			best = display;
			bestArea = area;
		}
	}
	if (!best) {
		return null;
	}

	return {
		x: clamp(Math.round(saved.x), best.x, best.x + best.width - size.width),
		y: clamp(Math.round(saved.y), best.y, best.y + best.height - size.height)
	};
}

/** `value` within [min, max]; `min` when the range is empty (a window larger than the display). */
function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(value, max));
}
