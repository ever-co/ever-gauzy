import * as ElectronLog from 'electron-log';
import { Logger, logger } from './logger';

/**
 * `logger.catchErrors(...)` is how the desktop apps install their uncaught-error handler at startup
 * (apps/desktop-timer/src/index.ts, apps/agent/src/main/init/logger.ts). Since electron-log 5 its own
 * `catchErrors` is a prototype method that needs electron-log's logger as `this`; handing it out
 * unbound made the call throw "this.processMessage is not a function" while the main script loaded,
 * so the packaged desktop timer stopped on Electron's "A JavaScript error occurred in the main
 * process" box before it opened a window.
 */
describe('Logger.catchErrors', () => {
	afterEach(() => {
		ElectronLog.errorHandler.stopCatching();
		ElectronLog.errorHandler.setOptions({ showDialog: true, onError: () => undefined });
	});

	it('installs the error handler when called the way the desktop apps call it', () => {
		const onError = jest.fn();

		expect(() => logger.catchErrors({ showDialog: false, onError })).not.toThrow();

		// What an uncaught exception in the main process now reaches: the app's own onError.
		ElectronLog.errorHandler.handle(new Error('boom'));
		expect(onError).toHaveBeenCalledTimes(1);
		expect(onError.mock.calls[0][0].error.message).toBe('boom');
	});

	it('catches for every Logger instance, not only the shared one', () => {
		const onError = jest.fn();

		new Logger('Agent').catchErrors({ showDialog: false, onError });

		ElectronLog.errorHandler.handle(new Error('agent boom'));
		expect(onError).toHaveBeenCalledTimes(1);
	});
});
