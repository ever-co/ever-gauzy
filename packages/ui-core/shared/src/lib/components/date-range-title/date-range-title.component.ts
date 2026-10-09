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
			/*
			 * Styled to match the breadcrumb trail (breadcrumb.component.scss), which
			 * is the other sub-heading line in a card header — same 13px scale, same
			 * regular weight, same muted token, same 0.25rem offset under the title.
			 * The old 14px/600 --gauzy-text-color-2 read as a competing second title.
			 *
			 * :host is a block so the range drops onto its own line under the heading
			 * text it sits beside, mirroring where .ga-page-title-trail lands. A
			 * custom element is phrasing content, so this stays valid inside an <h4>
			 * (unlike the trail's <nav><ol>, which is why that one gets relocated).
			 */
			:host {
				display: block;
				margin-top: 0.25rem;
			}
			span {
				/* 0.8125rem = nb-theme(menu-text-font-size), the trail's scale. */
				font-size: 0.8125rem;
				font-weight: 400;
				line-height: 1.25rem;
				letter-spacing: normal;
				color: var(--text-hint-color);
			}
		`
    ],
    standalone: false
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
