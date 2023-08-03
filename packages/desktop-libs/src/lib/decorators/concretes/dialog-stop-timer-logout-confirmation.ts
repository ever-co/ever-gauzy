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
			detail: 'Click Exit to Stop the Timer and Logout from the application.',
		};
	}
}
