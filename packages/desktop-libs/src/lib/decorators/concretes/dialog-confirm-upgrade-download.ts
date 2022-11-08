import { BaseDesktopDialogDecorator } from '../abstracts/base-desktop-dialog-decorator';
import { IDesktopDialog } from '../../interfaces';

export class DialogConfirmUpgradeDownload
	extends BaseDesktopDialogDecorator
	implements IDesktopDialog
{
	constructor(dialog: IDesktopDialog) {
		super(dialog);
		this.options = {
			...this.options,
			buttons: ['Upgrade', 'Skip Now'],
			detail: 'A new version is  available. Upgrade the application to download the updates.'
		};
	}
}
