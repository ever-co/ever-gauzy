import { BrowserWindow } from 'electron';
import { ServerTask } from './server-task';

export class ApiService extends ServerTask {
	constructor(
		readonly path: string,
		readonly env: any,
		readonly window: BrowserWindow,
		readonly signal: AbortSignal
	) {
		const args = { ...env, serviceName: 'api' };

		// Note: do not change this prefix because we may use it to detect the success message from the running server!
		const successMessage = 'Listening at http';

		const errorMessage = 'Error running API server:';

		super(path, args, window, successMessage, errorMessage, signal);
	}

	/**
	 * Starts the API server with the configured host, port, and base URL.
	 *
	 * @returns {Promise<void>} A promise that resolves when the server starts successfully.
	 * @throws Handles and logs any errors that occur during the startup process.
	 */
	public override async start(): Promise<void> {
		console.log('Starting API server...');
		try {
			this.setApiConfig();
			await super.start();
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Restarts the API server with updated configuration.
	 *
	 * @returns {Promise<void>} A promise that resolves when the server restarts successfully.
	 * @throws Handles and logs any errors that occur during the restart process.
	 */
	public override async restart(): Promise<void> {
		console.log('Restarting API server...');
		try {
			this.setApiConfig();
			await super.restart();
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Sets the API server configuration including host, port, and base URL.
	 *
	 * @returns {void}
	 */
	private setApiConfig(): void {
		console.log('Setting API config');
		this.args = {
			...this.args,
			API_HOST: '0.0.0.0',
			API_PORT: this.config.apiPort,
			API_BASE_URL: this.config.apiUrl
		};
	}
}
