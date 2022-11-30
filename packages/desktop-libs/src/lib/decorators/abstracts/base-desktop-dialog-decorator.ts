import { BrowserWindow, MessageBoxOptions } from 'electron';
import { IDesktopDialog } from '../../interfaces';


export abstract class BaseDesktopDialogDecorator implements IDesktopDialog {
	private readonly _dialogWrapper: IDesktopDialog;

	constructor(dialog: IDesktopDialog) {
		this._dialogWrapper = dialog;
	}

    public get browserWindow(): BrowserWindow {
        return this._dialogWrapper.browserWindow;
    }

	public get options(): MessageBoxOptions {
		return this._dialogWrapper.options;
	}

	public set options(value: MessageBoxOptions) {
		this._dialogWrapper.options = value;
	}

	public show(): Promise<any> {
		return this._dialogWrapper.show();
	}

	public close(): void {
		this._dialogWrapper.close();
	}
}
