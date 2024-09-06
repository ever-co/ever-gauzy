import { Store } from '@datorama/akita';
import { ISelector } from '../interfaces/selector.interface';

export abstract class SelectorStore<T> extends Store<ISelector<T>> {
	protected constructor(private readonly initialState: ISelector<T>) {
		super(initialState);
	}

	public updateData(data: T[]): void {
		this.update({ data });
	}

	public updateSelected(selected: T | string): void {
		if (!selected) {
			this.update({ selected: null });
			return;
		}

		if (typeof selected === 'string') {
			selected = this.getValue().data.find((value: any) => selected === value.id);
		}

		this.update({ selected });
	}

	public appendData(selected: T): void {
		if (!selected) {
			return;
		}
		const data = this.getValue().data;
		this.updateSelected(selected);
		this.updateData(data.concat([selected]));
	}

	public resetToInitialState(): void {
		this.update(this.initialState);
	}
}
