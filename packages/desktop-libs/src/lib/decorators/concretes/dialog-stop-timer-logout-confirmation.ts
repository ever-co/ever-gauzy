import { TranslateService } from '../../translation';
import { IDesktopDialog } from '../../interfaces';
import { BaseDesktopDialogDecorator } from '../abstracts/base-desktop-dialog-decorator';

export class DialogStopTimerLogoutConfirmation
	extends BaseDesktopDialogDecorator
	implements IDesktopDialog {
	constructor(dialog: IDesktopDialog) {
		super(dialog);
		this.options = {
			...this.options,
			buttons: [
				TranslateService.instant('BUTTONS.LOGOUT'),
				TranslateService.instant('BUTTONS.CANCEL'),
			],
			detail: TranslateService.instant(
				'TIMER_TRACKER.DIALOG.LOGOUT_CONFIRM'
			),
		};
	}
}
