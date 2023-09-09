import { BrowserWindow } from 'electron';
import { TranslateService } from '../../translation';
import { DesktopDialog } from '../../desktop-dialog';
import { IDesktopDialog } from '../../interfaces';
import { BaseDesktopDialogDecorator } from '../abstracts/base-desktop-dialog-decorator';

export class DialogErrorHandler
	extends BaseDesktopDialogDecorator
	implements IDesktopDialog {
	constructor(message: string) {
		super(
			new DesktopDialog(
				TranslateService.instant('TIMER_TRACKER.DIALOG.ERROR_HANDLER'),
				TranslateService.instant('TIMER_TRACKER.DIALOG.ERROR_OCCURRED'),
				BrowserWindow.getFocusedWindow()
			)
		);
		this.options = {
			...this.options,
			buttons: [
				TranslateService.instant('BUTTONS.IGNORE'),
				TranslateService.instant('BUTTONS.REPORT'),
				TranslateService.instant('BUTTONS.EXIT'),
			],
			detail: message,
			type: 'error',
			defaultId: 1,
		};
	}
}
