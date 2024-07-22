import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ISelectorVisibility } from './selector-builder-types';

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

	/**
	 * Sets the visibility of a selector by ID.
	 *
	 * @param id The ID of the selector.
	 * @param value The visibility value.
	 */
	setSelectorsVisibility(id: string, value: boolean): void {
		this.selectorsMapper.set(id, value);
	}

	/**
	 * Retrieves the visibility of all selectors and updates the BehaviorSubject.
	 */
	getSelectorsVisibility() {
		const selectors: any = {};
		this.getSelectorsIds().forEach((id) => {
			selectors[id] = this.getSelectorVisibilityById(id);
		});
		this._selectors$.next(selectors);
	}

	/**
	 * Retrieves the IDs of all selectors.
	 * @returns An array of selector IDs.
	 */
	getSelectorsIds() {
		return [...this.selectorsMapper.entries()].map(([id]) => id);
	}

	/**
	 * Retrieves the visibility of a selector by ID.
	 *
	 * @param id The ID of the selector.
	 * @returns The visibility of the selector.
	 */
	getSelectorVisibilityById(id: string) {
		if (!this.selectorsMapper.has(id)) {
			throw new Error(`No selector was found with the id "${id}"`);
		}

		return this.selectorsMapper.get(id);
	}

	/**
	 * Retrieves the current state of the selectors by returning the value of the `_selectors$` BehaviorSubject.
	 *
	 * @return {ISelectorVisibility} The current state of the selectors.
	 */
	getSelectors(): ISelectorVisibility {
		return this._selectors$.getValue();
	}
}
