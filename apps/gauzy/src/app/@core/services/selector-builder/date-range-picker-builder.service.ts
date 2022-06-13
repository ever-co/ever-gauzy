import { Injectable } from '@angular/core';
import moment from 'moment';
import { isNotEmpty } from '@gauzy/common-angular';
import { BehaviorSubject, Observable } from 'rxjs';

export interface IDatePickerConfig {
	readonly unitOfTime: moment.unitOfTime.Base,
	readonly isLockDatePicker: boolean;
	readonly isSaveDatePicker: boolean;
	readonly isSingleDatePicker: boolean;
}

export const DEFAULT_DATE_PICKER_CONFIG: IDatePickerConfig = {
	unitOfTime: 'month',
	isLockDatePicker: false,
	isSaveDatePicker: false,
	isSingleDatePicker: false
};

@Injectable({
	providedIn: 'root'
})
export class DateRangePickerBuilderService {
	
	private _datePickerConfig$: BehaviorSubject<IDatePickerConfig> = new BehaviorSubject(DEFAULT_DATE_PICKER_CONFIG);
	public datePickerConfig$: Observable<IDatePickerConfig> = this._datePickerConfig$.asObservable();

	constructor() {}

	setDatePickerConfig(options: IDatePickerConfig) {
		if (isNotEmpty(options)) {
			this._datePickerConfig$.next(options);
		}
	}
}
