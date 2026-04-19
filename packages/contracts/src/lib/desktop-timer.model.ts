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
	}
}

export type TLogLevel = 'info' | 'warn' | 'error';
export type TServiceName = 'timer' | 'screenshot' | 'timeslot';
export type TSyncStatus = 'pending' | 'success' | 'failure';

// Define the specific shapes of your two requests
export interface ISyncRequest {
    payload: string; // REQUIRED
    key: string;     // REQUIRED
    status?: TSyncStatus;
    response?: string;
    errorMessage?: string;
};

export interface ILogRequest {
    message: string; // REQUIRED
    logLevel?: TLogLevel;
    serviceName?: TServiceName;
	syncLogId?: number;
};

// Combine them into a union
export type AuditLogArgs = ISyncRequest | ILogRequest;
