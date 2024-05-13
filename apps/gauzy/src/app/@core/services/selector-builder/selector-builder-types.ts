export interface IDatePickerConfig {
	readonly unitOfTime: moment.unitOfTime.Base;
	readonly isLockDatePicker: boolean;
	readonly isSaveDatePicker: boolean;
	readonly isSingleDatePicker: boolean;
	readonly isDisableFutureDate: boolean;
}

export interface ISelectorVisibility {
	readonly organization: boolean;
	readonly date: boolean;
	readonly project: boolean;
	readonly employee: boolean;
	readonly team: boolean;
}
