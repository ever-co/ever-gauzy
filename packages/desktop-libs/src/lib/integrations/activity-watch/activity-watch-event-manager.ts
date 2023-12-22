import { BrowserWindow, ipcMain, IpcMainEvent } from 'electron';
import { IActivityWatchCollectEventData, IActivityWatchEventResult, ActivityWatchCollectEvent } from '@gauzy/contracts';

enum ActivityWatchMainEvent {
	PUSH_WINDOW = 'push_window_activity',
	PUSH_AFK = 'push_afk_activity',
	PUSH_CHROME = 'push_chrome_activity',
	PUSH_FIREFOX = 'push_firefox_activity',
	REMOVE = 'remove_aw_local_data',
	STATUS = 'aw_status',
	SET_TP = 'set_tp_aw',
	REMOVE_AFK = 'remove_afk_local_Data',
	PUSH_EDGE = 'push_edge_activity'
}

export class ActivityWatchEventManager {
	private channels = Object.values(ActivityWatchCollectEvent);
	private listeners = Object.values(ActivityWatchMainEvent);
	private static _instance: ActivityWatchEventManager;

	protected constructor() {
		this.listeners.forEach((listener) => {
			ipcMain.removeAllListeners(listener);
		});
	}

	public static get instance(): ActivityWatchEventManager {
		if (!this._instance) {
			this._instance = new ActivityWatchEventManager();
		}
		return this._instance;
	}

	public static collectActivities(data: IActivityWatchCollectEventData, window: BrowserWindow) {
		this.instance.channels.forEach((channel) => {
			window.webContents.send(channel, data);
		});
	}

	public static onPushWindowActivity<T>(
		listener: (event: IpcMainEvent, result?: IActivityWatchEventResult) => T
	): void {
		ipcMain.on(ActivityWatchMainEvent.PUSH_WINDOW, listener);
	}

	public static onPushChromeActivity<T>(
		listener: (event: IpcMainEvent, result?: IActivityWatchEventResult) => T
	): void {
		ipcMain.on(ActivityWatchMainEvent.PUSH_CHROME, listener);
	}

	public static onPushFirefoxActivity<T>(
		listener: (event: IpcMainEvent, result?: IActivityWatchEventResult) => T
	): void {
		ipcMain.on(ActivityWatchMainEvent.PUSH_FIREFOX, listener);
	}

	public static onPushAfkActivity<T>(listener: (event: IpcMainEvent, result?: IActivityWatchEventResult) => T): void {
		ipcMain.on(ActivityWatchMainEvent.PUSH_AFK, listener);
	}

	public static onRemoveLocalData<T>(listener: (event: IpcMainEvent, result?: T) => Promise<void>): void {
		ipcMain.on(ActivityWatchMainEvent.REMOVE, listener);
	}

	public static onStatusChange<T>(listener: (event: IpcMainEvent, result?: boolean) => void): void {
		ipcMain.on(ActivityWatchMainEvent.STATUS, listener);
	}

	public static onSet<T>(listener: (event: IpcMainEvent, result?: T) => void): void {
		ipcMain.on(ActivityWatchMainEvent.SET_TP, listener);
	}

	public static onRemoveAfkLocalData<T>(listener: (event: IpcMainEvent, result?: T) => Promise<void>): void {
		ipcMain.on(ActivityWatchMainEvent.REMOVE_AFK, listener);
	}

	public static onPushEdgeActivity<T>(
		listener: (event: IpcMainEvent, result?: IActivityWatchEventResult) => T
	): void {
		ipcMain.on(ActivityWatchMainEvent.PUSH_EDGE, listener);
	}
}

// Singleton Initialization
ActivityWatchEventManager.instance;
