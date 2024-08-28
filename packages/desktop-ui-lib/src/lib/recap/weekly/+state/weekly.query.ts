import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { Observable } from 'rxjs';
import { IDateRangePicker } from '../../shared/features/date-range-picker/date-picker.interface';
import { IWeeklyRecapState, WeeklyRecapStore } from './weekly.store';

@Injectable({ providedIn: 'root' })
export class WeeklyRecapQuery extends Query<IWeeklyRecapState> {
	public readonly range$: Observable<IDateRangePicker> = this.select((state) => state.range);
	public readonly state$: Observable<IWeeklyRecapState> = this.select();
	public readonly isLoading$: Observable<boolean> = this.selectLoading();

	constructor(protected store: WeeklyRecapStore) {
		super(store);
	}
}
