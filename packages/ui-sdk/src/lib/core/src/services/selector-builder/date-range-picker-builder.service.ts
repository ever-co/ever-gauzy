import { Injectable } from '@angular/core';
import * as moment from 'moment';
import { BehaviorSubject, Observable } from 'rxjs';
import { isNotEmpty } from '@gauzy/common-angular';
import { IDateRangePicker } from '@gauzy/contracts';
import { IDatePickerConfig } from './selector-builder-types';
import { NavigationService } from '../navigation/navigation.service';

export const DEFAULT_DATE_PICKER_CONFIG: IDatePickerConfig = {
	unitOfTime: 'week',
	isLockDatePicker: false,
	isSaveDatePicker: false,
	isSingleDatePicker: false,
	isDisableFutureDate: false
};

export const DEFAULT_DATE_RANGE: IDateRangePicker = {
	startDate: moment().startOf(DEFAULT_DATE_PICKER_CONFIG.unitOfTime).toDate(),
	endDate: moment().endOf(DEFAULT_DATE_PICKER_CONFIG.unitOfTime).toDate(),
	isCustomDate: false
};

@Injectable({
	providedIn: 'root'
})
export class DateRangePickerBuilderService {
	private _datePickerConfig$: BehaviorSubject<IDatePickerConfig | null> = new BehaviorSubject(null);
	public datePickerConfig$: Observable<IDatePickerConfig | null> = this._datePickerConfig$.asObservable();

	public dates$: BehaviorSubject<IDateRangePicker> = new BehaviorSubject(DEFAULT_DATE_RANGE);

	private _selectedDateRange$: BehaviorSubject<IDateRangePicker | null> = new BehaviorSubject(null);
	public selectedDateRange$: Observable<IDateRangePicker | null> = this._selectedDateRange$.asObservable();

	/**
	 * Getter & Setter for selected date range
	 */
	get selectedDateRange(): IDateRangePicker {
		return this.dates$.getValue();
	}
	set selectedDateRange(range: IDateRangePicker) {
		if (isNotEmpty(range)) {
			this._selectedDateRange$.next(range);
		}
	}

	constructor(private readonly navigationService: NavigationService) {}

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
	setDateRangePicker(dates: IDateRangePicker) {
		if (isNotEmpty(dates)) {
			console.log(dates);
			this.navigationService.navigate([], {
				date: moment(dates.startDate).format('MM-DD-YYYY'),
				date_end: moment(dates.endDate).format('MM-DD-YYYY')
			});
			this.dates$.next(dates);
		}
	}

	/**
	 * Refresh date range picker for specific dates
	 *
	 * @param date The date used to refresh the date range picker.
	 */
	refreshDateRangePicker(date: moment.Moment) {
		// Extract the unit of time from the current date picker configuration
		const { unitOfTime } = this._datePickerConfig$.getValue();

		// Calculate the start and end dates based on the provided date and unit of time
		const startDate = moment(date).startOf(unitOfTime);
		const endDate = moment(date).endOf(unitOfTime);

		// Update the date range picker with the new start and end dates
		this.setDateRangePicker({
			startDate: startDate.toDate(),
			endDate: endDate.toDate()
		});

		// Maintain the current date picker configuration
		this.setDatePickerConfig(this._datePickerConfig$.getValue());
	}
}
