import { TranslateService } from '../../translation';
import { IDesktopDialog } from '../../interfaces';
import { DialogStopTimerExitConfirmation } from './dialog-stop-timer-exit-confirmation';
import { BaseDesktopDialogDecorator } from '../abstracts/base-desktop-dialog-decorator';

export class DialogStopServerExitConfirmation
	extends BaseDesktopDialogDecorator
	implements IDesktopDialog {
	constructor(dialog: IDesktopDialog) {
		super(new DialogStopTimerExitConfirmation(dialog));
		this.options = {
			...this.options,
			detail: TranslateService.instant(
				'TIMER_TRACKER.DIALOG.EXIT_SERVER_CONFIRM'
			)
		};
	}
}
