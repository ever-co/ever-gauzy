import { ChildProcessFactory, Observer } from '../utils';
import { BrowserWindow } from 'electron';
import { ServerConfig } from '../../config';
import { Timeout } from '../../decorators';

export abstract class ServerTask {
	private processPath: string;
	protected args: Record<string, any>;
	protected window: BrowserWindow;
	protected successMessage: string;
	private errorMessage: string;
	protected config: ServerConfig;
	protected loggerObserver: Observer<string, void>;
	private stateObserver: Observer<boolean, void>;
	public restartObserver: Observer<{ type?: string; status?: string }, void>;
	protected pid: string;
	protected isRunning: boolean;
	protected signal: AbortSignal;
	private criticalMessageError = ['[CRITICAL::ERROR]', 'EADDRINUSE'];

	protected constructor(
		processPath: string,
		args: Record<string, any>,
		serverWindow: BrowserWindow,
		successMessage: string,
		errorMessage: string,
		signal: AbortSignal
	) {
		this.processPath = processPath;
		this.args = args;
		this.window = serverWindow;
		this.successMessage = successMessage;
		this.errorMessage = errorMessage;
		this.config = new ServerConfig();
		this.pid = `${this.args.serviceName}Pid`;
		this.signal = signal;
		this.isRunning = false;

		this.loggerObserver = new Observer((msg: string) => {
			console.log('Sending log_state:', msg);
			if (!this.window?.isDestroyed()) {
				this.window.webContents.send('log_state', { msg });
			}
		});

		this.stateObserver = new Observer((state: boolean) => {
			this.isRunning = state;
			if (!this.window?.isDestroyed()) {
				console.log('Sending running_state:', state);
				this.window.webContents.send('running_state', state);
			}
		});

		this.restartObserver = new Observer((options?) => {
			if (!this.window?.isDestroyed()) {
				console.log('Sending resp_msg:', options);
				this.window.webContents.send('resp_msg', { type: 'start_server', status: 'success', ...options });
			}
		});
	}

	/**
	 * Runs the server task with the specified configuration.
	 *
	 * This method creates a new process using the provided `processPath` and `args`.
	 * It listens for stdout and stderr events, resolving the promise when the task starts successfully
	 * or rejecting it in case of critical errors.
	 *
	 * @param {AbortSignal} signal - Signal used to abort the process.
	 * @returns {Promise<void>} Resolves when the task runs successfully, rejects on errors.
	 */
	@Timeout(5 * 60 * 1000)
	protected async runTask(signal: AbortSignal): Promise<void> {
		console.log('Running Server Task...');

		return new Promise<void>((resolve, reject) => {
			try {
				// Log process creation details
				console.log('Creating process with processPath:', this.processPath, 'args:', JSON.stringify(this.args));

				const service = ChildProcessFactory.createProcess(this.processPath, this.args, signal);
				console.log('Service created successfully');

				// Listen to stdout data
				service.stdout.on('data', (data: Buffer) => this.handleStdout(data, resolve, reject));

				// Listen to stderr data
				service.stderr.on('data', (data: Buffer) => this.handleStderr(data));

				// Save process ID
				this.config.setting = { [this.pid]: service.pid };
			} catch (error) {
				console.error('Error running task:', error);
				this.handleError(error);
				reject(error);
			}
		});
	}

	/**
	 * Handles the stdout data for the running task.
	 *
	 * @param {Buffer} data - Data emitted from the stdout stream.
	 * @param {Function} resolve - Function to resolve the promise.
	 * @param {Function} reject - Function to reject the promise.
	 * @returns {void}
	 */
	private handleStdout(
		data: Buffer,
		resolve: (value?: unknown) => void,
		reject: (reason?: unknown) => void
	): void {
		const msg = data.toString();
		this.loggerObserver.notify(msg);

		if (msg.includes(this.successMessage)) {
			const name = String(this.args.serviceName);
			this.stateObserver.notify(true);
			this.loggerObserver.notify(`☣︎ ${name.toUpperCase()} server listening at ${this.config[`${name}Url`]}`);
			resolve();
		}

		if (this.criticalMessageError.some((error) => msg.includes(error))) {
			this.handleError(msg);
			reject(msg);
		}
	}

	/**
	 * Handles the stderr data for the running task.
	 *
	 * @param {Buffer} data - Data emitted from the stderr stream.
	 * @returns {void}
	 */
	private handleStderr(data: Buffer): void {
		const errorMsg = data.toString();
		console.error('stderr:', errorMsg);
		this.loggerObserver.notify(errorMsg);
	}

	/**
	 * Terminates the server task if the process ID is available.
	 *
	 * This method checks if the process ID (`pid`) exists and if there is a corresponding setting.
	 * If both conditions are met, it attempts to kill the process and removes its configuration.
	 * Observers are notified of the state change and process termination.
	 * If an error occurs during termination, it handles the error based on the `callHandleError` flag.
	 *
	 * @param {boolean} [callHandleError=true] - Determines whether to handle errors using the `handleError` method.
	 * @returns {void}
	 */
	public kill(callHandleError: boolean = true): void {
		console.log('Attempting to Kill Server Task...');

		if (!this.pid || !this.config.setting[this.pid]) {
			console.log('No valid process found to kill.');
			return;
		}

		try {
			const processId = this.config.setting[this.pid];
			process.kill(processId); // Kill the process
			console.log(`Process [${processId}] terminated successfully.`);

			// Remove process configuration and notify observers
			delete this.config.setting[this.pid];
			this.stateObserver.notify(false);
			this.loggerObserver.notify(`[${this.pid.toUpperCase()}-${processId}]: stopped`);
		} catch (error) {
			// Handle specific error cases and notify the error handler
			if (callHandleError) {
				if (error.code === 'ESRCH') {
					error.message = `ERROR: Could not terminate the process [${this.pid}]. It was not running: ${error.message}`;
				}
				this.handleError(error, false); // Pass `false` to prevent retrying kill
			} else {
				console.error(`Unhandled error while killing process: ${error.message}`);
			}
		}
	}

	/**
	 * Returns whether the current process is running.
	 *
	 * This function checks two conditions:
	 * 1. `isRunning` is `true`, indicating the process is actively running.
	 * 2. A configuration setting exists for the current process ID (`pid`).
	 *
	 * @returns {boolean} True if the process is running and a valid configuration setting exists for the current PID; otherwise, false.
	 */
	public get running(): boolean {
		return this.isRunning && !!this.config.setting[this.pid];
	}

	/**
	 * Restarts the server task.
	 *
	 * This method performs the following steps:
	 * 1. Logs a message indicating the restart process has started.
	 * 2. Checks if the server task is currently running:
	 *    - If running, it stops the server task using the `stop` method.
	 * 3. Starts the server task asynchronously using the `start` method.
	 * 4. Logs success or failure of the restart operation.
	 *
	 * @returns {Promise<void>} Resolves once the restart process is complete.
	 */
	public async restart(): Promise<void> {
		console.log('Restarting Server Task...');

		try {
			if (this.running) {
				console.log('Server is currently running. Stopping the task...');
				this.stop();
			}

			console.log('Starting the server task...');
			await this.start();

			console.log('Server task restarted successfully.');
		} catch (error) {
			console.error('Error during server task restart:', error);
			this.handleError(error, false); // Prevent recursive kill calls during error handling
		}
	}

	/**
	 * Stops the server task gracefully.
	 *
	 * This method logs a message indicating the server task is being stopped
	 * and then invokes the `kill` method to terminate the task.
	 *
	 * @returns {void} No return value.
	 */
	public stop(): void {
		console.log('Stopping Server Task...');
		this.kill();
	}

	/**
	 * Starts the server task asynchronously and handles any errors.
	 *
	 * @returns {Promise<void>} Resolves when the task starts successfully.
	 */
	public async start(): Promise<void> {
		console.log('Starting Server Task...');
		try {
			await this.runTask(this.signal);
		} catch (error) {
			console.error('Error starting task:', error);
			this.handleError(error);
		}
	}

	/**
	 * Handles errors that occur during the server task execution.
	 *
	 * This method optionally attempts to terminate the process and notifies observers about the error.
	 * It logs the error message and updates the state observer to indicate a failure.
	 *
	 * @param {any} error - The error to handle.
	 * @param {boolean} [attemptKill=true] - Whether to attempt killing the process upon encountering the error.
	 * @returns {void}
	 */
	protected handleError(error: any, attemptKill: boolean = true): void {
		// Attempt to kill the process if requested
		if (attemptKill) {
			this.kill(false); // Pass `false` to avoid recursive calls to `handleError`
		}

		// Notify state and log observers
		this.stateObserver.notify(false);
		const errorMessage = `ERROR: ${this.errorMessage} ${error}`;

		console.error(this.errorMessage, error);
		this.loggerObserver.notify(errorMessage);
	}
}
