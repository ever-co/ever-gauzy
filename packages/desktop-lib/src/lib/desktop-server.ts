import { BrowserWindow } from 'electron';
import { DesktopServerFactory } from './desktop-server-factory';
import * as EventEmitter from 'events';
import { Observer } from './server';
import NotificationDesktop from './desktop-notifier';

// Define server states
export enum ServerState {
	STOPPED = 'stopped',
	RUNNING = 'running',
	RESTARTING = 'restarting'
}

/**
 * Represents a Desktop Server.
 */
export class DesktopServer extends EventEmitter {
	private state: ServerState = ServerState.STOPPED;
	private stateObserver: Observer<ServerState, void>;

	constructor(private readonly isOnlyApiServer = false) {
		super();

		this.stateObserver = new Observer((state: ServerState) => {
			this.state = state;
			this.notification(state);
			this.emit('stateChange', state);
		});
	}

	public async start(
		path?: any,
		env?: any,
		mainWindow?: BrowserWindow,
		signal?: AbortSignal,
		uiPort?: number
	): Promise<void> {
		console.log('DesktopServer -> start');

		try {
			if (this.state !== ServerState.STOPPED) {
				return; // Server already running or restarting
			}

			const apiInstance = DesktopServerFactory.getApiInstance(path?.api, env, mainWindow, signal);
			await this.startInstance(apiInstance);

			if (!this.isOnlyApiServer) {
				const uiInstance = DesktopServerFactory.getUiInstance(path?.ui, env, mainWindow, signal, uiPort);
				await this.startInstance(uiInstance);
			}

			// Notify running state
			this.stateObserver.notify(ServerState.RUNNING);
		} catch (error) {
			this.handleError(error);
		}
	}

	public async stop(): Promise<void> {
		if (this.state === ServerState.STOPPED) {
			return; // Server already stopped
		}

		if (!this.isOnlyApiServer) {
			const uiInstance = DesktopServerFactory.getUiInstance();
			await this.stopInstance(uiInstance);
		}

		const apiInstance = DesktopServerFactory.getApiInstance();
		await this.stopInstance(apiInstance);

		// Notify stopped state
		this.stateObserver.notify(ServerState.STOPPED);
	}

	public async restart(): Promise<void> {
		if (this.state === ServerState.STOPPED) {
			return; // Server is stopped no need to restarting
		}

		if (this.state === ServerState.RESTARTING) {
			return; // Server already restarting
		}

		// Notify restarting state
		this.stateObserver.notify(ServerState.RESTARTING);

		const apiInstance = DesktopServerFactory.getApiInstance();
		apiInstance?.restartObserver?.notify?.({ type: 'restart' });

		if (!this.isOnlyApiServer) {
			const uiInstance = DesktopServerFactory.getUiInstance();
			await this.restartInstance(uiInstance);
		}

		await this.restartInstance(apiInstance);

		// Notify running state
		this.stateObserver.notify(ServerState.RUNNING);
	}

	public get running(): boolean {
		return this.state === ServerState.RUNNING;
	}

	private async stopInstance(instance: any): Promise<void> {
		if (instance) {
			await instance.stop();
		}
	}

	private async startInstance(instance: any): Promise<void> {
		if (instance) {
			await instance.start();
		}
	}

	private async restartInstance(instance: any): Promise<void> {
		if (instance) {
			await instance.restart();
		}
	}

	private handleError(error: Error): void {
		console.error('Error occurred:', error);
	}

	private get name(): string {
		return process.env.DESCRIPTION || 'Server';
	}

	private notification(state: ServerState) {
		let message: string = '';
		switch (state) {
			case ServerState.STOPPED:
				message = 'Server is stopped';
				break;
			case ServerState.RESTARTING:
				message = 'Server is restarting';
				break;
			case ServerState.RUNNING:
				message = 'Server is running';
				break;
			default:
				console.log(`ERROR: Uncaught state: ${state}`);
				break;
		}

		const notifier = new NotificationDesktop();
		notifier.customNotification(message, this.name);
	}
}
