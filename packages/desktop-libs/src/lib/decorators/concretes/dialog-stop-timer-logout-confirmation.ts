import { IDesktopDialog } from '../../interfaces';
import { BaseDesktopDialogDecorator } from '../abstracts/base-desktop-dialog-decorator';

export class DialogStopTimerLogoutConfirmation
	extends BaseDesktopDialogDecorator
	implements IDesktopDialog {

	constructor(dialog: IDesktopDialog) {
		super(dialog);
		this.options = {
			...this.options,
			buttons: ['Logout', 'Cancel'],
			detail: 'Clicking logout, the timer will stop and then logged out.',
		};
	}
}
