import { Observable } from 'rxjs/internal/Observable';
import { Subject } from 'rxjs/internal/Subject';
import { GuiDrag } from './gui-drag.abstract';
import { Serializable } from './serializable.interface';

export abstract class DashboardPersistance implements Serializable<GuiDrag> {
	protected _KEY: string;
	protected _data: GuiDrag[];
	private _notifier$: Subject<Object> = new Subject();

	public serialize(values: GuiDrag[]): void {
		if (values.length === 0) return;
		if (this._KEY)
			localStorage.setItem(
				this._KEY,
				JSON.stringify(this.toJson(values))
			);
	}

	protected toJson(values: GuiDrag[]): Partial<GuiDrag>[] {
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

	public deSerialize(): Partial<GuiDrag>[] {
		return JSON.parse(
			localStorage.getItem(this._KEY)
		) as Partial<GuiDrag>[];
	}

	public get notifier$(): Observable<Object> {
		return this._notifier$.asObservable();
	}
	public set notifier$(value: Object) {
		this._notifier$.next(value);
	}
}
