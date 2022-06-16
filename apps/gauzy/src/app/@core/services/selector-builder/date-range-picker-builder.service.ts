import { Injectable } from '@angular/core';
import * as moment from 'moment';
import { BehaviorSubject, Observable } from 'rxjs';
import { isNotEmpty } from '@gauzy/common-angular';
import { IDateRangePicker } from '@gauzy/contracts';

export interface IDatePickerConfig {
	readonly unitOfTime: moment.unitOfTime.Base,
	readonly isLockDatePicker: boolean;
	readonly isSaveDatePicker: boolean;
	readonly isSingleDatePicker: boolean;
	readonly isDisableFutureDate: boolean;
}

export const DEFAULT_DATE_PICKER_CONFIG: IDatePickerConfig = {
	unitOfTime: 'month',
	isLockDatePicker: false,
	isSaveDatePicker: false,
	isSingleDatePicker: false,
	isDisableFutureDate: false
};

@Injectable({
	providedIn: 'root'
})
export class DateRangePickerBuilderService {
	
	private _datePickerConfig$: BehaviorSubject<IDatePickerConfig> = new BehaviorSubject(DEFAULT_DATE_PICKER_CONFIG);
	public datePickerConfig$: Observable<IDatePickerConfig> = this._datePickerConfig$.asObservable();

	public _datePickerRange$: BehaviorSubject<IDateRangePicker> = new BehaviorSubject({
		startDate: moment().startOf(DEFAULT_DATE_PICKER_CONFIG.unitOfTime).toDate(),
		endDate: moment().endOf(DEFAULT_DATE_PICKER_CONFIG.unitOfTime).toDate()
	});
	public datePickerRange$: Observable<IDateRangePicker> = this._datePickerRange$.asObservable();

	constructor() {}

	/**
	 * Override date range picker default configuration
	 * 
	 * @param options 
	 */
	setDatePickerConfig(options: IDatePickerConfig) {
		if (isNotEmpty(options)) {
			this._datePickerConfig$.next(options);
		}
	}

	/**
	 * Override date range picker default values
	 * 
	 * @param options 
	 */
	setDateRangePicker(options: IDateRangePicker) {
		if (isNotEmpty(options)) {
			this._datePickerRange$.next(options);
		}
	}
}
