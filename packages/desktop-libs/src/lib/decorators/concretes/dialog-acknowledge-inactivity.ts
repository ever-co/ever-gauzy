import { IDesktopDialog } from '../../interfaces';
import { BaseDesktopDialogDecorator } from '../abstracts/base-desktop-dialog-decorator';
import { LocalStore } from '../../desktop-store';

export class DialogAcknowledgeInactivity
	extends BaseDesktopDialogDecorator
	implements IDesktopDialog
{
	constructor(dialog: IDesktopDialog) {
		super(dialog);
		this.options = {
			...this.options,
			buttons: ['Acknowledge'],
			detail:
				'Timer was stopped due to inactivity period exceeding ' +
				this._inactivityTimeLimit +
				'. Please make sure you start timer again when continue working'
		};
	}

	private get _inactivityTimeLimit(): string {
		const auth = LocalStore.getStore('auth');
		const res = auth ? auth.inactivityTimeLimit : 10;
		return res + ' minute' + (res > 1 ? 's' : '');
	}
}
