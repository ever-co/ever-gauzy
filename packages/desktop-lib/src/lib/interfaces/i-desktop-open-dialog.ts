import { IDesktopDialog } from "./i-desktop-dialog";

export interface IDesktopOpenDialog extends IDesktopDialog {
	open(): string[];
}
