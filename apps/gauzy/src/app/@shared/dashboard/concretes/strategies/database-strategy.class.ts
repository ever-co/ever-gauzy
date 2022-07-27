import { BackupStrategy } from '../../interfaces/backup-strategy.interface';
import { GuiDrag } from '../../interfaces/gui-drag.abstract';

export class DatabaseStrategy implements BackupStrategy {
	get serializables(): Partial<GuiDrag>[] {
		throw new Error('Method not implemented.');
	}
	set serializables(value: Partial<GuiDrag>[]) {
		throw new Error('Method not implemented.');
	}
	serialize(): Partial<GuiDrag>[] {
		throw new Error('Method not implemented.');
	}
	deSerialize(): Partial<GuiDrag>[] {
		throw new Error('Method not implemented.');
	}
}
