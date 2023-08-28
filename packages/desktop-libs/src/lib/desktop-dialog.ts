import {BrowserWindow, dialog, MessageBoxOptions} from "electron";
import { IDesktopDialog } from './interfaces';
import { TranslateService } from './translation';

export class DesktopDialog implements IDesktopDialog {
	private _abortSignal: AbortController;
	private readonly _title: string;
	private readonly _message: string;
	private _options: MessageBoxOptions;
	private readonly _window: BrowserWindow;

	/**
	 * @param title  string - Title of the message box, some platforms will not show it.
	 * @param message string - Content of the message box.
	 * @param window BrowserWindow(Optional) - app's windows.
	 */
	constructor(title: string, message: string, window?: BrowserWindow) {
		this._message = message;
		this._title = title;
		this._abortSignal = new AbortController();
		this._options = {
			type: 'question',
			buttons: [
				TranslateService.instant('BUTTONS.YES'),
				TranslateService.instant('BUTTONS.NO'),
			],
			defaultId: 2,
			title: this._title,
			message: this._message,
			signal: this._abortSignal.signal,
		};
		this._window = window
	}

    get browserWindow(): BrowserWindow {
        return this._window;
    }

	/**
	 * Show dialog box with message over window
	 */
	public show(): Promise<any> {
		return dialog.showMessageBox(this._window, this._options);
	}

	/**
	 * close dialog if opened
	 */
	public close(): void {
		this._abortSignal.abort();
	}
	/**
	 * Getter for dialog option
	 */
	public get options(): MessageBoxOptions {
		return this._options;
	}
	/**
	 * Setter for dialog option
	 */
	public set options(value: MessageBoxOptions) {
		 this._options = value;
	}
}
