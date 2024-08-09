import { GuiDrag } from './gui-drag.abstract';

export interface IPersistance {
	get state(): Partial<GuiDrag>[];
}
