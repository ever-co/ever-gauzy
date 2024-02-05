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
			if (!this.window?.isDestroyed()) {
				this.window.webContents.send('log_state', { msg });
			}
		});
		this.stateObserver = new Observer((state: boolean) => {
			this.isRunning = state;
			if (!this.window?.isDestroyed()) {
				this.window.webContents.send('running_state', state);
			}
		});
		this.restartObserver = new Observer((options?) => {
			if (!this.window?.isDestroyed()) {
				this.window.webContents.send('resp_msg', { type: 'start_server', status: 'success', ...options });
			}
		});
	}

	@Timeout(60 * 1000)
	protected async runTask(signal: AbortSignal): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			try {
				const service = ChildProcessFactory.createProcess(this.processPath, this.args, signal);

				service.stdout.on('data', (data: any) => {
					const msg = data.toString();
					this.loggerObserver.notify(msg);
					if (msg.includes(this.successMessage)) {
						const name = String(this.args.serviceName);
						this.stateObserver.notify(true);
						this.loggerObserver.notify(
							`☣︎ ${name.toUpperCase()} server listern to ${this.config[`${name}Url`]}`
						);
						resolve();
					}

					if (this.criticalMessageError.some((error) => msg.includes(error))) {
						this.handleError(msg);
						reject(msg);
					}
				});

				service.stderr.on('data', (data: any) => {
					this.loggerObserver.notify(data.toString());
				});

				this.config.setting = { [this.pid]: service.pid };
			} catch (error) {
				this.handleError(error);
				reject(error);
			}
		});
	}

	public kill(): void {
		try {
			if (this.pid && this.config.setting[this.pid]) {
				process.kill(this.config.setting[this.pid]);
				delete this.config.setting[this.pid];
				this.stateObserver.notify(false);
				this.loggerObserver.notify(`[${this.pid.toUpperCase()}-${this.config.setting[this.pid]}]: stopped`);
			}
		} catch (error) {
			if (error.code === 'ESRCH') {
				error = `ERROR: Could not terminate the process [${this.pid}]. It was not running: ${error}`;
			}
			this.handleError(error);
		}
	}

	public get running(): boolean {
		return this.isRunning && !!this.config.setting[this.pid];
	}

	public async restart(): Promise<void> {
		if (this.running) {
			this.stop();
		}
		await this.start();
	}

	public stop(): void {
		this.kill();
	}

	public async start(): Promise<void> {
		try {
			await this.runTask(this.signal);
		} catch (error) {
			this.handleError(error);
		}
	}

	protected handleError(error: any) {
		this.kill();
		this.stateObserver.notify(false);
		console.error(this.errorMessage, error);
		this.loggerObserver.notify(`ERROR: ${this.errorMessage} ${error}`);
	}
}
