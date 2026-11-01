import { boardViewportOf } from './board-minimap.component';

describe('boardViewportOf', () => {
	it('gives nothing when the columns fit, a pixel of rounding included', () => {
		expect(boardViewportOf({ scrollLeft: 0, scrollWidth: 800, clientWidth: 800 })).toBeNull();
		expect(boardViewportOf({ scrollLeft: 0, scrollWidth: 801, clientWidth: 800 })).toBeNull();
		expect(boardViewportOf({ scrollLeft: 0, scrollWidth: 0, clientWidth: 0 })).toBeNull();
	});

	it('gives where the part on screen starts and how much of the board it is', () => {
		expect(boardViewportOf({ scrollLeft: 400, scrollWidth: 1600, clientWidth: 800 })).toEqual({
			start: 0.25,
			size: 0.5
		});
	});

	it('reads a right-to-left scroll, which counts below zero, from the board\'s start', () => {
		expect(boardViewportOf({ scrollLeft: -400, scrollWidth: 1600, clientWidth: 800 })).toEqual({
			start: 0.25,
			size: 0.5
		});
	});
});
