import { GuiDrag } from './gui-drag.abstract';
import { IPersistance } from './persistance.interface';
import { Serializable } from './serializable.interface';

export interface BackupStrategy extends Serializable<GuiDrag> {
	get serializables(): Partial<IPersistance>[];
	set serializables(value: Partial<IPersistance>[]);
}
