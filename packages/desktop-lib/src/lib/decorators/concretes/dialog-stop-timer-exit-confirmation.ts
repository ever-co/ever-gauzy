import { TranslateService } from '../../translation';
import { IDesktopDialog } from '../../interfaces';
import { BaseDesktopDialogDecorator } from '../abstracts/base-desktop-dialog-decorator';

export class DialogStopTimerExitConfirmation
	extends BaseDesktopDialogDecorator
	implements IDesktopDialog {

	constructor(dialog: IDesktopDialog) {
		super(dialog);
		this.options = {
			...this.options,
			buttons: [
				TranslateService.instant('BUTTONS.EXIT'),
				TranslateService.instant('BUTTONS.CANCEL'),
			],
			detail: TranslateService.instant(
				'TIMER_TRACKER.DIALOG.EXIT_CONFIRM'
			),
		};
	}
}
