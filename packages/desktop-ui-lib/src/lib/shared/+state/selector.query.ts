import { Query } from '@datorama/akita';
import { Observable } from 'rxjs';
import { ISelector } from '../interfaces/selector.interface';
import { SelectorStore } from './selector.store';

export abstract class SelectorQuery<T> extends Query<ISelector<T>> {
	/**
	 * Creates an instance of SelectorQuery.
	 * @param store The store of type {@link SelectorStore<T>}
	 */
	protected constructor(store: SelectorStore<T>) {
		super(store);
	}

	public get data$(): Observable<T[]> {
		return this.select((state) => state.data);
	}

	public get data(): T[] {
		return this.getValue().data;
	}

	public get selected$(): Observable<T> {
		return this.select((state) => state.selected);
	}

	public get selected(): T {
		return this.getValue().selected;
	}

	public get hasPermission$(): Observable<boolean> {
		return this.select((state) => state.hasPermission);
	}
}
