import { Store } from '@datorama/akita';
import { ISelector } from '../interfaces/selector.interface';

export abstract class SelectorStore<T> extends Store<ISelector<T>> {
	protected constructor(private readonly initialState: ISelector<T>) {
		super(initialState);
	}

	public updateData(data: T[]): void {
		this.update({ data });
	}

	public updateInfiniteList(list: { data: T[]; total: number }): void {
		const { data, total } = list;
		const items = this.getValue().data;
		this.update({
			data: [...new Map([...items, ...data].map((item) => [item['id'], item])).values()],
			total
		});
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
		this.updateData([...new Map([...data, selected].map((item) => [item['id'], item])).values()]);
		this.updateSelected(selected);
	}

	public resetToInitialState(): void {
		this.update(this.initialState);
	}

	public next(): void {
		const current = this.getValue().page;
		this.update({ page: current + 1 });
	}
}
