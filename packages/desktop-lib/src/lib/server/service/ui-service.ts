import { BrowserWindow, app } from 'electron';
import { ServerTask } from './server-task';
import { resolveDesktopListenHost } from '../../config/desktop-listen-host';

export class UiService extends ServerTask {
	/**
	 * @param allowLanAccess - Whether this app may listen on the network (Gauzy Server, as its LAN
	 *   access setting says); otherwise the web UI listens on the loopback address only.
	 */
	constructor(
		readonly path: string,
		readonly env: any,
		readonly window: BrowserWindow,
		signal: AbortSignal,
		readonly uiPort: number,
		readonly allowLanAccess: boolean = false
	) {
		const args = { isPackaged: app.isPackaged.toString(), serviceName: 'ui', ...env, UI_PORT: uiPort };
		const successMessage = `Listening on port`;
		const errorMessage = 'Error running UI server';
		super(path, args, window, successMessage, errorMessage, signal);
	}

	/**
	 * Starts the UI server with the necessary configuration.
	 *
	 * @returns {Promise<void>} Resolves when the server starts successfully.
	 */
	public override async start(): Promise<void> {
		console.log('Starting UI server...');
		await this.executeWithConfig(() => super.start());
	}

	/**
	 * Restarts the UI server with the updated configuration.
	 *
	 * @returns {Promise<void>} Resolves when the server restarts successfully.
	 */
	public override async restart(): Promise<void> {
		console.log('Restarting UI server...');
		await this.executeWithConfig(() => super.restart());
	}

	/**
	 * Sets the UI server configuration, including the UI port and the address it listens on (read at
	 * every start, so a change of the LAN access setting applies on the next restart).
	 *
	 * @returns {void}
	 */
	private setUiConfig(): void {
		console.log('Setting UI config');
		this.args = {
			...this.args,
			UI_PORT: this.config.uiPort,
			UI_HOST: resolveDesktopListenHost(this.config.setting, this.allowLanAccess)
		};
	}

	/**
	 * Executes a provided function after applying the UI configuration.
	 *
	 * @param {() => Promise<void>} action - The function to execute.
	 * @returns {Promise<void>} Resolves after executing the action.
	 */
	private async executeWithConfig(action: () => Promise<void>): Promise<void> {
		console.log('Executing with config');
		try {
			this.setUiConfig();
			await action();
		} catch (error) {
			this.handleError(error);
		}
	}
}
