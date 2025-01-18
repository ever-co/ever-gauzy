import { NbComponentStatus } from '@nebular/theme';

export interface IActionButton {
	label: string;
	icon?: string;
	status?: NbComponentStatus;
	action?: (data?: any) => Promise<void> | void;
	disabled?: boolean;
	hidden?: boolean;
}
