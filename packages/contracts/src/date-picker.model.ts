export interface IDateRangePicker {
	startDate: Date;
	endDate: Date;
	isCustomDate?: boolean;
	unitOfTime?: string;
}

//
export type DateRange = {
	start: string | Date;
	end: string | Date;
};
