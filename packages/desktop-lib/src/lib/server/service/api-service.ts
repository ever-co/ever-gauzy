import { BrowserWindow } from 'electron';
import { ServerTask } from './server-task';
import { redactSecretsForLog } from '../../config/desktop-secrets';
import { resolveDesktopListenHost } from '../../config/desktop-listen-host';
import { parsePublishedPasswordAccounts, reportsDesktopSeedCompleted } from '../../config/desktop-seed-credentials';
import { DesktopSignInNotices } from '../../desktop-sign-in-notices';

/** How much recent output is searched for the API's reports, so a line split across chunks is still found. */
const OUTPUT_TAIL_LENGTH = 4_000;

export class ApiService extends ServerTask {
	private outputTail = '';
	private seedReported = false;
	private publishedPasswordsReported = false;

	/**
	 * @param allowLanAccess - Whether this app may listen on the network (Gauzy Server and Gauzy API
	 *   Server, as their LAN access setting says). Gauzy Desktop's integrated server passes false and
	 *   always listens on the loopback address.
	 */
	constructor(
		readonly path: string,
		readonly env: any,
		readonly window: BrowserWindow,
		readonly signal: AbortSignal,
		readonly allowLanAccess: boolean = false
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
	 * The host is read at every start, so a change of the LAN access setting applies on the next
	 * restart.
	 *
	 * @returns {void}
	 */
	private setApiConfig(): void {
		console.log('Setting API configuration...');
		this.args = {
			...this.args,
			API_HOST: resolveDesktopListenHost(this.config.setting, this.allowLanAccess),
			API_PORT: this.config.apiPort,
			API_BASE_URL: this.config.apiUrl
		};
		this.outputTail = '';
		this.seedReported = false;
		this.publishedPasswordsReported = false;
		// The args carry the per-install signing/session secrets and DB password: never log their values.
		console.log('API configuration set:', redactSecretsForLog(this.args));
	}

	/**
	 * Watches the API's output for the two reports the sign-in notices act on: a finished seed of a
	 * new database (its accounts got this install's generated passwords) and, at boot, accounts of an
	 * existing database still using a published password. Each is recorded once per start.
	 *
	 * @param {string} output - A chunk of the API's stdout or stderr.
	 * @returns {void}
	 */
	protected override onOutput(output: string): void {
		this.outputTail = (this.outputTail + output).slice(-OUTPUT_TAIL_LENGTH);

		if (!this.seedReported && reportsDesktopSeedCompleted(this.outputTail)) {
			this.seedReported = true;
			// The child process's environment: the app's own, overridden by what was passed to it.
			DesktopSignInNotices.recordSeed({ ...process.env, ...this.args });
		}

		if (!this.publishedPasswordsReported) {
			const accounts = parsePublishedPasswordAccounts(this.outputTail);
			if (accounts.length > 0) {
				this.publishedPasswordsReported = true;
				DesktopSignInNotices.recordPublishedPasswords(accounts);
			}
		}
	}
}
