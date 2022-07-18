import { GuiDrag } from './gui-drag.abstract';
import { Serializable } from './serializable.interface';

export abstract class DashboardPersistance implements Serializable<GuiDrag> {
	protected _KEY: string;
	protected _data: GuiDrag[];

	public serialize(values: GuiDrag[]): void {
		if (values.length === 0) return;
		const toJson: Partial<GuiDrag>[] = values.map(
			(value: Partial<GuiDrag>) => {
				return {
					position: value.position,
					isCollapse: value.isCollapse,
					isExpand: value.isExpand,
					hide: value.hide,
					title: value.title
				};
			}
		);
		localStorage.setItem(this._KEY, JSON.stringify(toJson));
	}
	public deSerialize(): Partial<GuiDrag>[] {
		return JSON.parse(
			localStorage.getItem(this._KEY)
		) as Partial<GuiDrag>[];
	}
}
