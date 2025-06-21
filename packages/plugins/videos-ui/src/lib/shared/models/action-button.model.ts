import { NbComponentStatus } from '@nebular/theme';
import { Observable, of } from 'rxjs';

export interface IActionButton {
	label?: string;
	icon?: string;
	status?: NbComponentStatus;
	loading?: Observable<boolean>;
	action?: (data?: any) => Promise<void> | void;
	disabled?: boolean;
	hidden?: boolean;
}

export class ActionButton implements IActionButton {
	label?: string;
	icon?: string;
	status?: NbComponentStatus;
	loading?: Observable<boolean>;
	action?: (data?: any) => Promise<void> | void;
	disabled?: boolean;
	hidden?: boolean;

	constructor(input: IActionButton) {
		Object.assign(
			this,
			{
				loading: of(false),
				hidden: false,
				disabled: false,
				status: 'primary'
			},
			input
		);
	}
}
