import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ISelectorVisibility {
	readonly organization: boolean;
	readonly date: boolean;
	readonly project: boolean;
	readonly employee: boolean;
	readonly team: boolean;
}

export const DEFAULT_SELECTOR_VISIBILITY: ISelectorVisibility = {
	organization: true,
	date: true,
	employee: true,
	project: true,
	team: true
};

@Injectable({
	providedIn: 'root'
})
export class SelectorBuilderService {
	private selectorsMapper = new Map<string, boolean>();
	private _selectors$: BehaviorSubject<ISelectorVisibility> = new BehaviorSubject(DEFAULT_SELECTOR_VISIBILITY);
	public selectors$: Observable<ISelectorVisibility> = this._selectors$.asObservable();

	constructor() {}

	setSelectorsVisibility(id: string, value: boolean): void {
		this.selectorsMapper.set(id, value);
	}

	getSelectorsVisibility() {
		const selectors: any = {};
		this.getSelectorsIds().forEach((id) => {
			selectors[id] = this.getSelectorVisibilityById(id);
		});
		this._selectors$.next(selectors);
	}

	getSelectorsIds() {
		return [...this.selectorsMapper.entries()].map(([id]) => id);
	}

	getSelectorVisibilityById(id: string) {
		if (!this.selectorsMapper.has(id)) {
			throw new Error(`No selector was found with the id "${id}"`);
		}

		return this.selectorsMapper.get(id);
	}
}
