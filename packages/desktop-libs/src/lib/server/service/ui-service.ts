import { BrowserWindow, app } from 'electron';
import { ServerTask } from './server-task';

export class UiService extends ServerTask {
	constructor(
		readonly path: string,
		readonly env: any,
		readonly window: BrowserWindow,
		signal: AbortSignal,
		readonly uiPort: number
	) {
		const args = { isPackaged: app.isPackaged.toString(), serviceName: 'ui', ...env, UI_PORT: uiPort };
		const successMessage = `Listening on port`;
		const errorMessage = 'Error running UI server';
		super(path, args, window, successMessage, errorMessage, signal);
	}

	public override async start(): Promise<void> {
		try {
			this.setUiConfig();
			await super.start();
		} catch (error) {
			this.handleError(error);
		}
	}

	public override async restart(): Promise<void> {
		try {
			this.setUiConfig();
			await super.restart();
		} catch (error) {
			this.handleError(error);
		}
	}

	private setUiConfig(): void {
		Object.assign(this.args, {
			UI_PORT: this.config.uiPort
		});
	}
}
