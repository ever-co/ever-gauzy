// Represents a date range with a start date and end date.
export interface IDateRangePicker {
	startDate: Date; // The start date of the date range.
	endDate: Date; // The end date of the date range.
	isCustomDate?: boolean; // Optional flag to indicate if it's a custom date range.
}

// Represents a time period with a start date and end date using moment.js.
export interface TimePeriod {
	startDate: moment.Moment; // The start date of the time period.
	endDate: moment.Moment; // The end date of the time period.
}

// Represents a collection of date ranges where each range is indexed by a string key.
export interface DateRanges {
	[index: string]: [moment.Moment, moment.Moment]; // Key-value pairs of date ranges.
}

// Enum defining keys for common date range options.
export enum DateRangeKeyEnum {
	TODAY = 'Today',
	YESTERDAY = 'Yesterday',
	CURRENT_WEEK = 'Current Week',
	LAST_WEEK = 'Last Week',
	CURRENT_MONTH = 'Current Month',
	LAST_MONTH = 'Last Month'
}

export interface DateRangeClicked {
	label: DateRangeKeyEnum;
}
