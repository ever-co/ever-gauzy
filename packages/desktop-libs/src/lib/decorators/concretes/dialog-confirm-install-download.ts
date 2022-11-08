import { BaseDesktopDialogDecorator } from '../abstracts/base-desktop-dialog-decorator';
import { IDesktopDialog } from '../../interfaces';

export class DialogConfirmInstallDownload
	extends BaseDesktopDialogDecorator
	implements IDesktopDialog
{
	constructor(dialog: IDesktopDialog) {
		super(dialog);
		this.options = {
			...this.options,
			buttons: ['Restart', 'Later'],
			detail: 'A new version has been downloaded. Restart the application to apply the updates.'
		};
	}
}
