import { GuiDrag } from './gui-drag.abstract';

export interface IPersistance {
	restore(): Partial<GuiDrag>[];
}
