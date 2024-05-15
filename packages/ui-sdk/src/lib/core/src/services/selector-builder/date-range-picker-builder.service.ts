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
	isDisableFutureDate: false,
	isDisablePastDate: false
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

	constructor(private readonly _navigationService: NavigationService) {}

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
	 * @param dates An object containing the start date, end date, and possibly other properties related to the date range picker.
	 */
	setDateRangePicker(dates: IDateRangePicker) {
		// Check if dates object is not empty
		if (isNotEmpty(dates)) {
			// Update the BehaviorSubject `dates$` with the new dates
			this.dates$.next(dates);

			// Navigate to the same route with updated query parameters representing the start date and end date
			this.navigateWithQueryParams(dates);
		}
	}

	/**
	 * Navigates to the current route with specified query parameters, while preserving existing ones.
	 *
	 * @param queryParams The query parameters to be attached.
	 */
	navigateWithQueryParams(dates: IDateRangePicker): void {
		if (isNotEmpty(dates)) {
			// Navigate to the same route with updated query parameters representing the start date and end date
			this._navigationService.navigate([], {
				date: moment(dates.startDate).format('YYYY-MM-DD'),
				date_end: moment(dates.endDate).format('YYYY-MM-DD'),
				unit_of_time: dates.unitOfTime,
				is_custom_date: dates.isCustomDate
			});
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
