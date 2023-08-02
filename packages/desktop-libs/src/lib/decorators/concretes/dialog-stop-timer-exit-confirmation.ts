import { IDesktopDialog } from '../../interfaces';
import { BaseDesktopDialogDecorator } from '../abstracts/base-desktop-dialog-decorator';

export class DialogStopTimerExitConfirmation
	extends BaseDesktopDialogDecorator
	implements IDesktopDialog {

	constructor(dialog: IDesktopDialog) {
		super(dialog);
		this.options = {
			...this.options,
			buttons: ['Exit', 'Cancel'],
			detail: 'Clicking on exit, the timer will stop and then close.',
		};
	}
}
