import { IDesktopDialog } from '../../interfaces';
import { BaseDesktopDialogDecorator } from '../abstracts/base-desktop-dialog-decorator';
import { LocalStore } from '../../desktop-store';
import { TranslateService } from '../../translation';

export class DialogAcknowledgeInactivity
	extends BaseDesktopDialogDecorator
	implements IDesktopDialog {
	constructor(dialog: IDesktopDialog) {
		super(dialog);
		this.options = {
			...this.options,
			buttons: [TranslateService.instant('BUTTONS.ACKNOWLEDGE')],
			detail: TranslateService.instant(
				'TIMER_TRACKER.DIALOG.STOPPED_DU_INACTIVITY',
				{ inactivity: this._inactivityTimeLimit }
			)
		};
	}

	private get _inactivityTimeLimit(): string {
		const auth = LocalStore.getStore('auth');
		const timeLimit = auth ? auth.inactivityTimeLimit : 10;
		const proofDuration = auth ? auth.activityProofDuration : 1;
		const res = timeLimit + proofDuration;
		return res + ' minute' + (res > 1 ? 's' : '');
	}
}
