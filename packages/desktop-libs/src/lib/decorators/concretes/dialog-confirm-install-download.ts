import { BaseDesktopDialogDecorator } from '../abstracts/base-desktop-dialog-decorator';
import { IDesktopDialog } from '../../interfaces';
import { TranslateService } from '../../translation';

export class DialogConfirmInstallDownload
	extends BaseDesktopDialogDecorator
	implements IDesktopDialog
{
	constructor(dialog: IDesktopDialog) {
		super(dialog);
		this.options = {
			...this.options,
			buttons: [TranslateService.instant('BUTTONS.RESTART'), TranslateService.instant('BUTTONS.LATER')],
			detail: 'A new version has been downloaded. Restart the application to apply the updates.'
		};
	}
}
