import { Injectable } from '@angular/core';
import moment from 'moment';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class DateRangePickerBuilderService {
	private _pickerRangeUnitOfTime$: BehaviorSubject<string> = new BehaviorSubject('month');
	public pickerRangeUnitOfTime$: Observable<string> = this._pickerRangeUnitOfTime$.asObservable();

	constructor() {}

	setDatePicker(options: any) {
		if (options && options.hasOwnProperty('unitOfTime')) {
			this.setPickerRangeUnitOfTime(options.unitOfTime);
		}
	}

	setPickerRangeUnitOfTime(unit: moment.unitOfTime.Base): void {
        this._pickerRangeUnitOfTime$.next(unit);
	}
}
