import { BackupStrategy } from '../../interfaces/backup-strategy.interface';
import { GuiDrag } from '../../interfaces/gui-drag.abstract';
import { IPersistance } from '../../interfaces/persistance.interface';

export class DatabaseStrategy implements BackupStrategy {
	get serializables(): Partial<IPersistance>[] {
		throw new Error('Method not implemented.');
	}
	set serializables(value: Partial<IPersistance>[]) {
		throw new Error('Method not implemented.');
	}
	serialize(): Partial<GuiDrag>[] {
		throw new Error('Method not implemented.');
	}
	deSerialize(): Partial<GuiDrag>[] {
		throw new Error('Method not implemented.');
	}
}
