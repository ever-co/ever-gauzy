import { Component, Input } from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { DateRangePickerBuilderService } from '@gauzy/ui-core/core';
import { DateFormatPipe } from '../../pipes';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-date-range-title',
	template: `<span>{{ title }}</span>`,
	styles: [
		`
			span {
				font-size: 14px;
				font-weight: 600;
				line-height: 16px;
				letter-spacing: -0.009em;
				color: var(--gauzy-text-color-2);
			}
		`
	]
})
export class DateRangeTitleComponent {
	/**
	 * @Input start: Date
	 * Represents the starting date for a given time range or period.
	 * This value is passed from the parent component and used for time-related calculations or display.
	 */
	@Input() start: Date;

	/**
	 * @Input end: Date
	 * Represents the ending date for a given time range or period.
	 * This value is passed from the parent component and is used to define the endpoint of a time range.
	 */
	@Input() end: Date;

	/**
	 * @Input format: string
	 * Represents the format to be used for displaying the date values.
	 * This could define how the `start` and `end` dates are displayed (e.g., 'MM/DD/YYYY', 'YYYY-MM-DD').
	 */
	@Input() format: string;

	constructor(
		readonly _dateFormatPipe: DateFormatPipe,
		readonly _dateRangePickerBuilderService: DateRangePickerBuilderService
	) {}

	/**
	 * GET date range title
	 */
	get title(): string {
		// Destructure the date range for start and end dates
		const { startDate, endDate } = this._dateRangePickerBuilderService.selectedDateRange;

		// Check if it’s a single date picker
		const isSingleDatePicker = this._dateRangePickerBuilderService.datePickerConfig.isSingleDatePicker;

		// Use provided `start` and `end` or fallback to the default range values
		const start = this._dateFormatPipe.transform(this.start || startDate, null, this.format);
		const end = this._dateFormatPipe.transform(this.end || endDate, null, this.format);

		// If it's a single date picker, return only the start date, otherwise return the date range
		return isSingleDatePicker ? start : [start, end].filter(Boolean).join(' - ');
	}
}
