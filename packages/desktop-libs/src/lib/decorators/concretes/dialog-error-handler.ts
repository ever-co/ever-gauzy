import { BrowserWindow } from 'electron';
import { DesktopDialog } from '../../desktop-dialog';
import { IDesktopDialog } from '../../interfaces';
import { BaseDesktopDialogDecorator } from '../abstracts/base-desktop-dialog-decorator';

export class DialogErrorHandler
	extends BaseDesktopDialogDecorator
	implements IDesktopDialog {
	constructor(message: string) {
		super(
			new DesktopDialog(
				'Error Handler',
				'An Error Occured',
				BrowserWindow.getFocusedWindow()
			)
		);
		this.options = {
			...this.options,
			buttons: ['Ignore', 'Report', 'Exit'],
			detail: message,
			type: 'error',
			defaultId: 1
		};
	}
}
