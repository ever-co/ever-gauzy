import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SelectorQuery } from './selector.query';
import { SelectorStore } from './selector.store';

@Injectable({
	providedIn: 'root'
})
export abstract class SelectorService<T> {
	protected constructor(
		public readonly selectorStore: SelectorStore<T>,
		public readonly selectorQuery: SelectorQuery<T>
	) {}

	public abstract load(): Promise<void>;

	public getAll$(): Observable<T[]> {
		return this.selectorQuery.data$;
	}

	public getAll(): T[] {
		return this.selectorQuery.data;
	}

	public get selected(): T {
		return this.selectorQuery.selected;
	}

	public set selected(selected: T | string) {
		this.selectorStore.updateSelected(selected);
	}

	public set hasPermission(hasPermission: boolean) {
		this.selectorStore.update({ hasPermission: hasPermission });
	}

	public get hasPermission(): boolean {
		return this.selectorStore.getValue().hasPermission;
	}

	public get hasPermission$(): Observable<boolean> {
		return this.selectorQuery.hasPermission$;
	}

	public get selected$(): Observable<T> {
		return this.selectorQuery.selected$;
	}
}
