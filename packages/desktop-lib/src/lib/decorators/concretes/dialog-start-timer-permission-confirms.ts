import { BaseDesktopDialogDecorator } from '../abstracts/base-desktop-dialog-decorator';
import { IDesktopDialog } from '../../interfaces';
import { TranslateService } from '../../translation';

export class DialogConfirmStartTimerPermission
	extends BaseDesktopDialogDecorator
	implements IDesktopDialog
{
	constructor(dialog: IDesktopDialog) {
		super(dialog);
		this.options = {
			...this.options,
			buttons: [TranslateService.instant('BUTTONS.START_TIMER_ANYWAY'), TranslateService.instant('BUTTONS.OPEN_SETTING')],
			detail: 'Screen record permission not granted, start timer without screen capture'
		};
	}
}
