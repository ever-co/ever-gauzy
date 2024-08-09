export interface IArrowStrategy {
	/**
	 * method action require request parameter
	 * @param request
	 */
	action(request: any, unitOfTime: moment.unitOfTime.Base): any;
}
