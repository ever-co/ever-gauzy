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

export const DEFAULT_DATE_RANGE: IDateRangePicker = {
	startDate: moment().startOf(DEFAULT_DATE_PICKER_CONFIG.unitOfTime).toDate(),
	endDate: moment().endOf(DEFAULT_DATE_PICKER_CONFIG.unitOfTime).toDate(),
	isCustomDate: false
}

@Injectable({
	providedIn: 'root'
})
export class DateRangePickerBuilderService {
	public _datePickerConfig$: BehaviorSubject<IDatePickerConfig> = new BehaviorSubject(DEFAULT_DATE_PICKER_CONFIG);
	public datePickerConfig$: Observable<IDatePickerConfig> = this._datePickerConfig$.asObservable();

	public dates$: BehaviorSubject<IDateRangePicker> = new BehaviorSubject(DEFAULT_DATE_RANGE);

	public _selectedDateRange$: BehaviorSubject<IDateRangePicker> = new BehaviorSubject(DEFAULT_DATE_RANGE);
	public selectedDateRange$: Observable<IDateRangePicker> = this._selectedDateRange$.asObservable();

	constructor() {}

	/**
	 * Getter & Setter for selected date range
	 */
	get selectedDateRange(): IDateRangePicker {
		return this._selectedDateRange$.getValue();
	}
	set selectedDateRange(range: IDateRangePicker) {
		this._selectedDateRange$.next(range);
	}

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
			this.dates$.next(options);
		}
	}

	/**
	 * Refresh date range picker for specific dates
	 *
	 * @param date
	 */
	refreshDateRangePicker(date: moment.Moment) {
		const { unitOfTime } = this._datePickerConfig$.getValue();

		const startDate = moment(date).startOf(unitOfTime);
		const endDate = moment(date).endOf(unitOfTime);

		this.setDateRangePicker({
			startDate: startDate.toDate(),
			endDate: endDate.toDate()
		});
		this.setDatePickerConfig(this._datePickerConfig$.getValue());
	}
}
