import type ElectronStore from 'electron-store';

/**
 * Represents the structure of a file path object used in the application.
 */
export interface FilePath {
	/**
	 * The path to the icon file associated with this file path.
	 */
	iconPath: string;
}

/**
 * Defines the structure of the Electron Store schema for type safety and consistency.
 *
 * The `StoreSchema` interface represents the schema used in the Electron Store.
 * Each property in the schema corresponds to a specific key in the store and
 * ensures type safety when accessing or modifying the data.
 *
 * Example:
 * ```
 * const store = new Store<StoreSchema>();
 * store.set('filePath', { iconPath: '/path/to/icon.png' });
 * const filePath = store.get('filePath');
 * console.log(filePath.iconPath); // Outputs: '/path/to/icon.png'
 * ```
 */
export interface StoreSchema extends IApplicationConfig {
	/**
	 * Represents the file path configuration stored in the Electron Store.
	 * Includes the `iconPath` property which specifies the path to an icon.
	 */
	filePath: FilePath;

	/**
	 * Represents the application setting configuration stored in the Electron Store.
	 * Includes the `appSetting` property which specifies the application settings.
	 */
	appSetting: IApplicationSetting;
}

/**
 * Represents a generic interface for a service that interacts with the Electron Store.
 *
 * @template T - The type of data stored in the Electron Store.
 */
export interface IStoreService<T> {
	setDefault(): void;
	update(values: Partial<T>): void;
	find(): T | undefined;
}

/**
 * Represents the structure of a configuration object used in the application.
 *
 */
export interface IConfig {
	isLocalServer: boolean;
	port: number;
	serverUrl: string;
	autoStart?: boolean;
	isSetup?: boolean;
	db?: string;
	version?: string;
	secureProxy?: {
		secure: boolean;
		enable: boolean;
		ssl: {
			key: string;
			cert: string;
		};
	};
	serverConfigConnected?: boolean;
	hardwareAccelerationDisabled?: boolean;
}

export interface IAuth {
	token?: string;
	employeeId?: string;
	organizationId?: string;
	userId?: string;
	tenantId?: string;
	isLogout?: boolean;
	allowScreenshotCapture?: boolean;
	refreshToken?: string;
}

export interface IProject {
	projectId?: string;
	taskId?: string;
	note?: string;
	aw?: {
		isAw: boolean;
	};
	organizationContactId?: string;
	organizationTeamId?: string;
}

/**
 * Represents the application settings configuration.
 */
export interface IApplicationSetting {
	monitor: {
		captured: 'all' | 'active-only';
	};
	timer: {
		updatePeriod: 1 | 5 | 10;
	};
	SCREENSHOTS_ENGINE_METHOD: 'ElectronDesktopCapturer';
	screenshotNotification: boolean;
	simpleScreenshotNotification: boolean;
	/** Display that shows the screenshot notification: an Electron display id, or `null` for the primary display */
	screenshotNotificationDisplayId?: number | null;
	mutedNotification: boolean;
	autoLaunch: boolean;
	visibleAwOption: boolean;
	randomScreenshotTime: boolean;
	visibleWakatimeOption: boolean;
	trackOnPcSleep: boolean;
	awIsConnected: boolean;
	preventDisplaySleep: boolean;
	automaticUpdate: boolean;
	automaticUpdateDelay: number; // in hours
	timerStarted: boolean;
	cdnUpdater: {
		github: boolean;
		digitalOcean: boolean;
	};
	prerelease: boolean;
	preferredLanguage: string;
	zone: 'local' | string; // Default to 'local', but allow other strings
	alwaysOn: boolean;
	enforced: boolean;
	theme: 'light' | 'dark'; // Based on nativeTheme
	/**
	 * Asynchronous timer data sync: timer jobs (durations, time-slot links, ActivityWatch events) go through a
	 * persistent SQLite queue that survives quits and crashes and retries failures, instead of the in-memory queue.
	 * Off unless `true`; read when the first timer job of a session is queued, so a change applies from the next start.
	 */
	asyncTimerDataSync?: boolean;
	[key: string]: any; // Allow for additional settings
}

export interface IAdditionalSetting {
	[key: string]: any;
}

export interface IApplicationConfig {
	setting: IApplicationSetting | undefined;
	config: IConfig | undefined;
	auth: IAuth | undefined;
	project: IProject | undefined;
	additionalSetting: IAdditionalSetting | undefined;
}

/**
 * The part of electron-store's API used here, which electron-store 11 inherits from `conf`. `conf` is ESM-only and
 * publishes its types under `exports` only, which this repository's `moduleResolution: node` ignores: there an
 * ElectronStore appears to have none of these members (only the type is affected; the instance has them all). The
 * signatures are `conf`'s, less its dot-notation overloads (as electron-store 8 declared them).
 * Drop once the repository resolves modules by `exports` (`moduleResolution: node16` or `bundler`).
 */
export interface IElectronStoreApi<T extends Record<string, any> = Record<string, unknown>> {
	readonly path: string;
	readonly size: number;
	store: T;
	get<Key extends keyof T>(key: Key): T[Key];
	get<Key extends keyof T>(key: Key, defaultValue: Required<T>[Key]): Required<T>[Key];
	get<Key extends string, Value = unknown>(key: Exclude<Key, keyof T>, defaultValue?: Value): Value;
	set<Key extends keyof T>(key: Key, value?: T[Key]): void;
	set(key: string, value: unknown): void;
	set(object: Partial<T>): void;
	has(key: keyof T | string): boolean;
	reset<Key extends keyof T>(...keys: Key[]): void;
	delete(key: keyof T | string): void;
	clear(): void;
	onDidChange<Key extends keyof T>(key: Key, callback: (newValue?: T[Key], oldValue?: T[Key]) => void): () => void;
	onDidAnyChange(callback: (newValue?: Readonly<T>, oldValue?: Readonly<T>) => void): () => void;
}

/** An electron-store instance (see `IElectronStoreApi`). */
export type ElectronStoreOf<T extends Record<string, any> = Record<string, unknown>> = ElectronStore<T> &
	IElectronStoreApi<T>;

export type IStore = ElectronStoreOf<StoreSchema>;
