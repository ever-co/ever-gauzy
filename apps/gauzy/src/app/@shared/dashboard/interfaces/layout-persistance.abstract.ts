import { GuiDrag } from './gui-drag.abstract';
import { Serializable } from './serializable.interface';

export abstract class LayoutPersistance implements Serializable<GuiDrag> {
	protected _KEY: string;

	public serialize(): void {}

	public toObject(values: GuiDrag[]): Partial<GuiDrag>[] {
		return values.map((value: Partial<GuiDrag>) => {
			return {
				position: value.position,
				isCollapse: value.isCollapse,
				isExpand: value.isExpand,
				hide: value.hide,
				title: value.title
			};
		});
	}

	protected sorting(): void {}

	public deSerialize(): Partial<GuiDrag>[] {
		return JSON.parse(
			localStorage.getItem(this._KEY)
		) as Partial<GuiDrag>[];
	}
}
