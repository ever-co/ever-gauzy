import { BackupStrategy } from '../../interfaces/backup-strategy.interface';
import { GuiDrag } from '../../interfaces/gui-drag.abstract';
import { IPersistance } from '../../interfaces/persistance.interface';

export class LocalstorageStrategy implements BackupStrategy {
	private _serializables: Partial<IPersistance>[];

	constructor() {}

	deSerialize(): Partial<GuiDrag>[];
	deSerialize(
		store?: Partial<GuiDrag>[],
		values?: Partial<GuiDrag>[]
	): Partial<GuiDrag>[];
	deSerialize(store?: any, values?: any): Partial<GuiDrag>[] {
		return store
			? store
					.flatMap((serialized: Partial<GuiDrag>) => {
						return values.map((draggableObject: GuiDrag) => {
							if (
								draggableObject.position === serialized.position
							) {
								draggableObject.isCollapse =
									serialized.isCollapse;
								draggableObject.isExpand = serialized.isExpand;
								draggableObject.title = serialized.title;
								draggableObject.hide = serialized.hide;
								return draggableObject;
							}
						});
					})
					.filter((deserialized: GuiDrag) => deserialized)
			: [];
	}

	serialize(): Partial<GuiDrag>[] {
		const size: number = this.serializables[0].restore().length;
		return this.serializables
			.flatMap((serializable: IPersistance) =>
				serializable
					.restore()
					.map((restored: Partial<GuiDrag>) => restored.toObject())
			)
			.reverse()
			.slice(0, size)
			.reverse();
	}

	public get serializables(): Partial<IPersistance>[] {
		return this._serializables;
	}

	public set serializables(value: Partial<IPersistance>[]) {
		this._serializables = value;
	}
}
