export enum TimerActionTypeEnum {
	START_TIMER = 'startTimer',
	STOP_TIMER = 'stopTimer'
}

export enum TimerSyncStateEnum {
	PENDING = 'pending',
	SYNCING = 'syncing',
	SYNCED = 'synced',
	FAILED = 'failed'
}

export interface DesktopSetupConfig extends IDesktopSecret {
	port?: string;
	portUi?: string;
	host?: string;
	protocol?: string;
	isSetup?: boolean;
	serverUrl?: string;
	isLocalServer?: boolean;
	/**
	 * Gauzy Server and Gauzy API Server: whether other computers on the network may connect to the API
	 * and the web UI. Only `false` turns it off (an install from before the setting has none). Gauzy
	 * Desktop's integrated server ignores it and accepts connections from the same computer only.
	 */
	lanAccess?: boolean | null;
	postgres?: {
		dbHost: string;
		dbPort: string;
		dbName: string;
		dbUsername: string;
		dbPassword: string;
	};
	db?: string;
	aw?: boolean;
	awHost?: string;
	wakatime?: boolean;
	gauzyWindow?: boolean;
	timeTrackerWindow?: boolean;
	serverConfigConnected?: boolean;
	secureProxy?: {
		secure: boolean;
		enable: boolean;
		ssl: {
			key: string;
			cert: string;
		};
	};
	autoStart?: boolean;
}

export interface IDesktopSecret {
	secret: {
		jwt: string;
		refresh_token: string;
		/** JWT_VERIFICATION_TOKEN_SECRET of the local API (email-confirmation tokens). Generated per install. */
		verification_token?: string;
		/** EXPRESS_SESSION_SECRET of the local API. Generated per install. */
		session?: string;
	}
}

/**
 * The screenshot sound chosen on one computer in the desktop apps (#6715): a copy of the file the user picked, kept in
 * the app's own data folder so that it stays on that computer and keeps playing when the original is moved or deleted.
 */
export interface IDesktopScreenshotSound {
	/** The copy that is played, inside the app's data folder. */
	path: string;
	/** The name of the file the user picked, shown in the settings. */
	name: string;
}

/** IPC channels (`ipcRenderer.invoke`) of the custom screenshot sound, answered with an {@link IDesktopScreenshotSoundResult}. */
export enum DesktopScreenshotSoundChannel {
	/** Asks for a sound file and uses a copy of it from now on. */
	CHOOSE = 'SELECT_SCREENSHOT_SOUND',
	/** Goes back to the sound bundled with the app. */
	RESET = 'RESET_SCREENSHOT_SOUND'
}

/** Why a picked file was not used as the screenshot sound. */
export enum DesktopScreenshotSoundError {
	/** Not one of the supported audio formats. */
	UNSUPPORTED = 'unsupported',
	/** Larger than a short notification sound needs to be. */
	TOO_LARGE = 'too_large',
	/** It could not be read or copied. */
	FAILED = 'failed'
}

export interface IDesktopScreenshotSoundResult {
	/** The custom sound in use now, `null` for the bundled sound. */
	sound: IDesktopScreenshotSound | null;
	/** The file dialog was closed without a choice: nothing changed. */
	canceled?: boolean;
	/** The picked file was refused: nothing changed. */
	error?: DesktopScreenshotSoundError;
}

/** The sound settings a desktop window reads with {@link DesktopSoundSettingsChannel.GET}, without the rest of the settings. */
export interface IDesktopSoundSettings {
	/** Whether a short sound plays when this computer starts or stops tracking (#7141). Off unless switched on. */
	timerStartStopSound: boolean;
}

/** IPC channels (`ipcRenderer.invoke`) of the sound settings. */
export enum DesktopSoundSettingsChannel {
	/** Answers with the {@link IDesktopSoundSettings}. */
	GET = 'GET_SOUND_SETTINGS'
}

export type TLogLevel = 'info' | 'warn' | 'error' | 'all';
export type TServiceName = 'timer' | 'screenshot' | 'timeslot' | 'all';
export type TSyncStatus = 'pending' | 'success' | 'failure' | 'all';


export interface ILogRequest {
    message: string; // REQUIRED
    logLevel?: TLogLevel;
    serviceName?: TServiceName;
};

export interface ILogItems {
	id: number;
	logLevel: TLogLevel;
	serviceName: TServiceName;
	message: string;
	createdAt: Date;
}

export interface ILogRequestPage {
	limit: number;
	serviceName: TServiceName;
	page: number;
	logLevel?: TLogLevel;
}

export interface IOSInfo {
	os: NodeJS.Platform;
	arch: NodeJS.Architecture;
	version: string;
}

// Combine them into a union
export type AuditLogArgs = ILogRequest;
