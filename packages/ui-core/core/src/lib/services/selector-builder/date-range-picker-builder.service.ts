import { Injectable } from '@angular/core';
import moment from 'moment';
import { BehaviorSubject, Observable } from 'rxjs';
import { isNotEmpty, toTimezone } from '@gauzy/ui-core/common';
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
	 * Refresh the date range picker so it shows the day/week containing `date`.
	 *
	 * @param date  The date used to refresh the picker. Callers pass an INSTANT (e.g. a time log's
	 *              `startedAt`), not a wall-clock day.
	 * @param timeZone Organization timezone (IANA). Pass it whenever `date` is an instant that belongs
	 *              to an organization-local day — see below for why omitting it can select the wrong day.
	 */
	refreshDateRangePicker(date: moment.Moment, timeZone?: string) {
		// Extract the unit of time from the current date picker configuration
		const unitOfTime = this.datePickerConfig.unitOfTime;

		// The picker's value is a WALL-CLOCK day that is later re-interpreted in the ORGANIZATION's
		// timezone (the range is written to the URL as 'YYYY-MM-DD' and read back with a UTC offset).
		// `date`, however, is an instant. Taking startOf/endOf in the BROWSER's zone therefore picks
		// the wrong calendar day whenever the two disagree across midnight.
		//
		// Concretely: a log created at midnight in an org on UTC+8 is the instant 16:00Z the previous
		// day. A browser on UTC computes startOf('day') as that PREVIOUS day, so the daily view jumps
		// back a day and shows "No Data" for the log the user just created. It bites any user whose
		// browser is behind their organization, and it is deterministic, not a race.
		//
		// Re-express the instant as the same wall-clock time in the browser's zone before truncating,
		// so the day is the organization's day while the value stays the browser-local Date the rest
		// of the picker expects.
		const local = timeZone ? moment(toTimezone(date, timeZone).format('YYYY-MM-DDTHH:mm:ss')) : moment(date);
		// Calculate the start and end dates based on the provided date and unit of time
		const startDate = local.clone().startOf(unitOfTime).toDate();
		const endDate = local.clone().endOf(unitOfTime).toDate();

		this.setDateRangePicker({ startDate, endDate }); // Update the date range picker with the new start and end dates
		this.setDatePickerConfig(this._datePickerConfig$.getValue()); // Maintain the current date picker configuration
	}
}
