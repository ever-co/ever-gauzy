import { computeCounterPoints, counterPointBackground } from './CounterPoint';
import { computePopoverPosition } from './Popover';
import { progressStatus } from '../helpers/progress-status';

describe('CounterPoint — computeCounterPoints (gauzy-counter-point parity)', () => {
	it('uses a working day (86400) when total is 0 and normalises to 24 dots', () => {
		const points = computeCounterPoints(0, 43200, '#0088FE');
		expect(points).toHaveLength(24);
		expect(points.filter((p) => p.color === '#0088FE')).toHaveLength(12);
		expect(points.filter((p) => p.color === 'basic')).toHaveLength(12);
	});

	it('renders one dot per unit when total is 24 or less', () => {
		const points = computeCounterPoints(5, 2, '');
		expect(points).toHaveLength(5);
		// no colour given → status from the percentage (2/5 = 40% → warning)
		expect(points.slice(0, 2).every((p) => p.color === 'warning')).toBe(true);
		expect(points.slice(2).every((p) => p.color === 'basic')).toBe(true);
	});

	it('paints literal colours verbatim, statuses via theme variables and basic via the danger track', () => {
		expect(counterPointBackground('#0088FE')).toBe('#0088FE');
		expect(counterPointBackground('rgb(0, 214, 143)')).toBe('rgb(0, 214, 143)');
		expect(counterPointBackground('success')).toBe('var(--color-success-default)');
		expect(counterPointBackground('basic')).toBe('var(--progress-bar-danger-background-color)');
	});
});

describe('progressStatus (mirror of @gauzy/ui-core/common)', () => {
	it('maps the four bands', () => {
		expect(progressStatus(0)).toBe('danger');
		expect(progressStatus(25)).toBe('danger');
		expect(progressStatus(26)).toBe('warning');
		expect(progressStatus(50)).toBe('warning');
		expect(progressStatus(51)).toBe('info');
		expect(progressStatus(75)).toBe('info');
		expect(progressStatus(76)).toBe('success');
		expect(progressStatus(100)).toBe('success');
	});
});

describe('Popover — computePopoverPosition', () => {
	const trigger = { top: 100, left: 300, width: 100, height: 30 };
	const panel = { width: 200, height: 120 };
	const viewport = { width: 1000, height: 800 };

	it('centres under the trigger for `bottom` and points the arrow at the trigger centre', () => {
		const pos = computePopoverPosition(trigger, panel, viewport, 'bottom', 8);
		expect(pos.top).toBe(138);
		expect(pos.left).toBe(250);
		expect(pos.arrowLeft).toBe(100);
	});

	it('aligns edges for bottom-start / bottom-end and sits above for top', () => {
		expect(computePopoverPosition(trigger, panel, viewport, 'bottom-start', 8).left).toBe(300);
		expect(computePopoverPosition(trigger, panel, viewport, 'bottom-end', 8).left).toBe(200);
		expect(computePopoverPosition({ ...trigger, top: 400 }, panel, viewport, 'top', 8).top).toBe(400 - 120 - 8);
		// Not enough room above → clamped to the viewport margin.
		expect(computePopoverPosition(trigger, panel, viewport, 'top', 8).top).toBe(8);
	});

	it('clamps to the viewport and keeps the arrow inside the panel', () => {
		const nearEdge = computePopoverPosition({ top: 100, left: 950, width: 40, height: 30 }, panel, viewport, 'bottom', 8);
		expect(nearEdge.left).toBe(1000 - 200 - 8);
		// trigger centre 970 − panel left 792 = 178, inside the 12px arrow margin
		expect(nearEdge.arrowLeft).toBe(178);
		const farEdge = computePopoverPosition({ top: 100, left: 990, width: 10, height: 30 }, panel, viewport, 'bottom', 8);
		expect(farEdge.arrowLeft).toBe(200 - 12);
		const nearBottom = computePopoverPosition({ top: 780, left: 300, width: 40, height: 30 }, panel, viewport, 'bottom', 8);
		expect(nearBottom.top).toBe(800 - 120 - 8);
	});
});
