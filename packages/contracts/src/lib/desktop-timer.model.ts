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

/**
 * IPC channel (`ipcRenderer.invoke`) answered by the main process of Gauzy Server and Gauzy API
 * Server with this computer's network addresses ({@link IDesktopNetworkAddress}[], best first).
 */
export const DESKTOP_NETWORK_ADDRESSES_CHANNEL = 'GET_NETWORK_ADDRESSES';

/**
 * A network address of the computer a desktop server app runs on, as offered next to the
 * "Server Hostname / IP Address" setting. Read from the operating system only (no online lookup).
 */
export interface IDesktopNetworkAddress {
	/** The network interface, such as `Wi-Fi`, `Ethernet`, `eth0` or `en0`. */
	name: string;
	/** The address, IPv6 without brackets, such as `192.168.1.20` or `fd00::20`. */
	address: string;
	family: 'IPv4' | 'IPv6';
	/** Whether the interface looks like a virtual machine, container or VPN adapter (listed last). */
	virtual: boolean;
}

// Combine them into a union
export type AuditLogArgs = ILogRequest;
