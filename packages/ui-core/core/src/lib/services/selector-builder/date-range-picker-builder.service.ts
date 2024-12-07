import { Injectable } from '@angular/core';
import moment from 'moment';
import { BehaviorSubject, Observable } from 'rxjs';
import { isNotEmpty } from '@gauzy/ui-core/common';
import { IDateRangePicker } from '@gauzy/contracts';
import { IDatePickerConfig } from './selector-builder-types';

// Define the default date picker configuration
export const DEFAULT_DATE_PICKER_CONFIG: IDatePickerConfig = {
	unitOfTime: 'week',
	isLockDatePicker: false,
	isSaveDatePicker: false,
	isSingleDatePicker: false,
	isDisableFutureDate: false,
	isDisablePastDate: false
};

// Define the default date range picker
export const DEFAULT_DATE_RANGE: IDateRangePicker = {
	startDate: moment().startOf(DEFAULT_DATE_PICKER_CONFIG.unitOfTime).toDate(),
	endDate: moment().endOf(DEFAULT_DATE_PICKER_CONFIG.unitOfTime).toDate(),
	isCustomDate: false
};

@Injectable({ providedIn: 'root' })
export class DateRangePickerBuilderService {
	public dates$: BehaviorSubject<IDateRangePicker> = new BehaviorSubject(DEFAULT_DATE_RANGE);
	private _datePickerConfig$: BehaviorSubject<IDatePickerConfig | null> = new BehaviorSubject(null);
	public datePickerConfig$: Observable<IDatePickerConfig | null> = this._datePickerConfig$.asObservable();
	private _selectedDateRange$: BehaviorSubject<IDateRangePicker | null> = new BehaviorSubject(null);
	public selectedDateRange$: Observable<IDateRangePicker | null> = this._selectedDateRange$.asObservable();

	/**
	 * Sets a new selected date range.
	 *
	 * @param range - The new date range to set.
	 */
	set selectedDateRange(range: IDateRangePicker) {
		if (isNotEmpty(range)) {
			this._selectedDateRange$.next(range);
			this.dates$.next(range);
		}
	}

	/**
	 * Gets the currently selected date range.
	 */
	get selectedDateRange(): IDateRangePicker {
		return this.dates$.getValue();
	}

	/**
	 * Gets the current date picker configuration.
	 */
	get datePickerConfig(): IDatePickerConfig {
		return this._datePickerConfig$.getValue();
	}

	/**
	 * Sets a new date picker configuration.
	 *
	 * @param config - The new configuration to set.
	 */
	setDatePickerConfig(config: IDatePickerConfig) {
		if (isNotEmpty(config)) {
			this._datePickerConfig$.next(config);
		}
	}

	/**
	 * Updates the date range picker with new start and end dates.
	 *
	 * @param dates - An object containing the start date and end date.
	 */
	setDateRangePicker(dates: IDateRangePicker) {
		// Check if dates object is not empty
		if (isNotEmpty(dates)) {
			// Update the BehaviorSubject `dates$` with the new dates
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
		const unitOfTime = this.datePickerConfig.unitOfTime;
		// Calculate the start and end dates based on the provided date and unit of time
		const startDate = moment(date).startOf(unitOfTime).toDate();
		const endDate = moment(date).endOf(unitOfTime).toDate();

		this.setDateRangePicker({ startDate, endDate }); // Update the date range picker with the new start and end dates
		this.setDatePickerConfig(this._datePickerConfig$.getValue()); // Maintain the current date picker configuration
	}
}
