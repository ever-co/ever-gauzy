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
	 * @returns {Promise<void>} Resolves when the server starts successfully.
	 * @throws Logs and handles any errors that occur during the startup process.
	 */
	public override async start(): Promise<void> {
		console.log('Starting API server...');
		await this.runWithApiConfig(super.start.bind(this));
	}

	/**
	 * Restarts the API server with updated configuration.
	 *
	 * @returns {Promise<void>} Resolves when the server restarts successfully.
	 * @throws Logs and handles any errors that occur during the restart process.
	 */
	public override async restart(): Promise<void> {
		console.log('Restarting API server...');
		await this.runWithApiConfig(super.restart.bind(this));
	}

	/**
	 * Executes a given server operation (e.g., start or restart) with the API configuration applied.
	 *
	 * @param {() => Promise<void>} operation - The server operation to execute.
	 * @returns {Promise<void>} Resolves when the operation completes successfully.
	 * @throws Logs and handles any errors that occur during the operation.
	 */
	private async runWithApiConfig(operation: () => Promise<void>): Promise<void> {
		try {
			console.log('Running server operation with API configuration...');
			this.setApiConfig();
			await operation();
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
		console.log('Setting API configuration...');
		this.args = {
			...this.args,
			API_HOST: '0.0.0.0',
			API_PORT: this.config.apiPort,
			API_BASE_URL: this.config.apiUrl,
		};
		console.log('API configuration set:', this.args);
	}
}
