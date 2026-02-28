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

export interface DesktopSetupConfig {
	port?: string;
	portUi?: string;
	host?: string;
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
