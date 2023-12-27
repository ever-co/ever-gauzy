import { IDesktopOpenDialog } from './i-desktop-open-dialog';

export interface IDesktopSaveDialog extends IDesktopOpenDialog {
	save(): string;
}
