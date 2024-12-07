import { BaseDesktopDialogDecorator } from '../abstracts/base-desktop-dialog-decorator';
import { IDesktopDialog } from '../../interfaces';
import { TranslateService } from '../../translation';

export class DialogConfirmUpgradeDownload
	extends BaseDesktopDialogDecorator
	implements IDesktopDialog
{
	constructor(dialog: IDesktopDialog) {
		super(dialog);
		this.options = {
			...this.options,
			buttons: [TranslateService.instant('BUTTONS.UPGRADE'), TranslateService.instant('BUTTONS.SKIP_NOW')],
			detail: 'A new version is  available. Upgrade the application by downloading the updates.'
		};
	}
}
