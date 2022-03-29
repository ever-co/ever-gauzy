export interface IArrowStrategy {
	/**
	 * method action require request parameter
	 * @param request
	 */
	action(request: any): any;
}

export interface IDateRangeStrategy {
	startDate: Date;
	endDate: Date;
}
