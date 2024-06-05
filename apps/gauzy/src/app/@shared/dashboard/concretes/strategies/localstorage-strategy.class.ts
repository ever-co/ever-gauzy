import { BackupStrategy, GuiDrag } from '@gauzy/ui-sdk/common';

export class LocalstorageStrategy implements BackupStrategy {
	private _serializables: Partial<GuiDrag>[];

	constructor() {}

	deSerialize(): Partial<GuiDrag>[];
	deSerialize(store?: Partial<GuiDrag>[], values?: Partial<GuiDrag>[]): Partial<GuiDrag>[];
	deSerialize(store?: any, values?: any): Partial<GuiDrag>[] {
		return store
			? store
					.flatMap((serialized: Partial<GuiDrag>) => {
						return this.serializables.map((draggableObject: GuiDrag) => {
							if (draggableObject.position === serialized.position) {
								draggableObject.isCollapse = serialized.isCollapse;
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

	/**
	 *
	 * @returns
	 */
	serialize(): Partial<GuiDrag>[] {
		return this.serializables.map((restored: Partial<GuiDrag>) => restored.toObject());
	}

	/**
	 *
	 */
	public get serializables(): Partial<GuiDrag>[] {
		return this._serializables;
	}

	/**
	 *
	 */
	public set serializables(value: Partial<GuiDrag>[]) {
		this._serializables = value;
	}
}
