// @ts-expect-error https://thymikee.github.io/jest-preset-angular/docs/getting-started/test-environment
globalThis.ngJest = {
	testEnvironmentOptions: {
		errorOnUnknownElements: true,
		errorOnUnknownProperties: true
	}
};
import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

setupZoneTestEnv();

/**
 * The desktop apps render this library behind a preload script that exposes `window.electronAPI`
 * (see apps/agent/src/main/preload/contextBridge.ts): IPC, `remote.app`, `shell` and electron-log.
 * `ElectronService` and `LoggerService` read everything from it, so without one every component that
 * touches IPC or the logger failed at construction ("reading 'on'", "reading 'error'", "reading
 * 'app'") before its spec could assert anything. This is an inert bridge of the same shape: IPC calls
 * go nowhere (`invoke` resolves to undefined), and the log forwards to the real console so test
 * output stays readable.
 */
const noop = (): void => undefined;
const testConsole = {
	log: console.log.bind(console),
	info: console.info.bind(console),
	warn: console.warn.bind(console),
	error: console.error.bind(console),
	debug: console.debug.bind(console)
};
(window as any).electronAPI = {
	ipcRenderer: {
		send: noop,
		invoke: async (): Promise<undefined> => undefined,
		on: noop,
		once: noop,
		removeListener: noop,
		removeAllListeners: noop
	},
	getGlobal: (): Record<string, unknown> => ({}),
	shell: { openExternal: async (): Promise<void> => undefined },
	remote: {
		app: {
			getLocale: (): string => 'en',
			getName: (): string => 'gauzy-desktop-test',
			getVersion: (): string => '0.0.0',
			quit: noop
		}
	},
	log: { ...testConsole, functions: testConsole }
};
