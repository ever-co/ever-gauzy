import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { Observable } from 'rxjs';
import { IDateRangePicker } from '../../shared/features/date-range-picker/date-picker.interface';
import { IMonthlyRecapState, MonthlyRecapStore } from './monthly.store';

@Injectable({ providedIn: 'root' })
export class MonthlyRecapQuery extends Query<IMonthlyRecapState> {
	public readonly range$: Observable<IDateRangePicker> = this.select((state) => state.range);
	public readonly state$: Observable<IMonthlyRecapState> = this.select();
	public readonly isLoading$: Observable<boolean> = this.selectLoading();

	constructor(protected store: MonthlyRecapStore) {
		super(store);
	}
}
