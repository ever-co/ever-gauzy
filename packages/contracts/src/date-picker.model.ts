export interface IDateRangePicker {
	startDate: Date;
	endDate: Date;
	isCustomDate?: boolean;
}

//
export type DateRange = {
	start: string | Date;
	end: string | Date;
};
