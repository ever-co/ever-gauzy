import { GuiDrag } from './gui-drag.abstract';
import { Serializable } from './serializable.interface';
export interface BackupStrategy extends Serializable<GuiDrag> {
	get serializables(): Partial<GuiDrag>[];
	set serializables(value: Partial<GuiDrag>[]);
}
