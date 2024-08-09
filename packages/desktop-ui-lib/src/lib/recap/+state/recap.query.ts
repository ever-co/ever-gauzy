import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { Observable } from 'rxjs';
import { IDateRangePicker } from '../shared/features/date-range-picker/date-picker.interface';
import { IRecapState, RecapStore } from './recap.store';

@Injectable({ providedIn: 'root' })
export class RecapQuery extends Query<IRecapState> {
	public readonly range$: Observable<IDateRangePicker> = this.select((state) => state.range);
	public readonly state$: Observable<IRecapState> = this.select();
	public readonly isLoading$: Observable<boolean> = this.selectLoading();

	constructor(protected store: RecapStore) {
		super(store);
	}

	public get tasks() {
		return this.getValue().tasks;
	}

	public get projects() {
		return this.getValue().projects;
	}

	public get range() {
		return this.getValue().range;
	}

	public get activities() {
		return this.getValue().activities;
	}

	public get timeSlots() {
		return this.getValue().timeSlots;
	}

	public get count() {
		return this.getValue().count;
	}
}
