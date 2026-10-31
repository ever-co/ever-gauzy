/**
 * The Agent's screenshot notification is closed by its window manager, which also owns its auto-hide timeout: the
 * close button (#7643) must go through it, or that timeout would close the next notification early.
 */
const baseHideNow = jest.fn();
jest.mock('@gauzy/desktop-window', () => ({
	ScreenCaptureNotification: class {
		constructor(
			public readonly path?: string,
			public readonly preloadPath?: string
		) {}

		hideNow(): void {
			baseHideNow();
		}
	}
}));

import { ScreenCaptureWindow } from './screen-capture-window';

describe('ScreenCaptureWindow', () => {
	beforeEach(() => baseHideNow.mockClear());

	it('lets the window manager close it when its close button is clicked', () => {
		const hideNotification = jest.fn();
		const window = new ScreenCaptureWindow('/ui', '/preload.js', jest.fn(), hideNotification);

		window.hideNow();

		expect(hideNotification).toHaveBeenCalledTimes(1);
		expect(baseHideNow).not.toHaveBeenCalled();
	});

	it('hides itself without a window manager callback', () => {
		const window = new ScreenCaptureWindow('/ui', '/preload.js', jest.fn());

		window.hideNow();

		expect(baseHideNow).toHaveBeenCalledTimes(1);
	});

	it('is shown by the window manager', () => {
		const showNotification = jest.fn();
		const window = new ScreenCaptureWindow('/ui', '/preload.js', showNotification);

		window.show('data:image/png;base64,AAAA');

		expect(showNotification).toHaveBeenCalledWith('data:image/png;base64,AAAA');
	});
});
