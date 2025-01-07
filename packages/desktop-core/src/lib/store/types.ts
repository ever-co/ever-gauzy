import * as ElectronStore from 'electron-store';

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
	secureProxy?: {
		secure: boolean;
		enable: boolean;
		ssl: {
			key: string;
			cert: string;
		};
	};
}

export interface IAuth {
	token?: string;
	employeeId?: string;
	organizationId?: string;
	userId?: string;
	tenantId?: string;
	isLogout?: boolean;
	allowScreenshotCapture?: boolean;
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

export type IStore = ElectronStore<StoreSchema>;
