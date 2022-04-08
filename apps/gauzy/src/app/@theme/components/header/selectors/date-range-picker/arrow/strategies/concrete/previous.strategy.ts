import * as moment from 'moment';
import { IDateRangePicker } from "@gauzy/contracts";
import { IArrowStrategy } from "../arrow-strategy.interface";

export class Previous implements IArrowStrategy {
	/**
	 * Implementation of action method
	 * @param request
	 * @returns any type of request
	 */
	action(
		request: IDateRangePicker,
		unitOfTime: moment.unitOfTime.Base
	): IDateRangePicker {
		const { startDate } = request;
		const end = moment(startDate).subtract(1, 'days');
		const start = moment(end).startOf(unitOfTime);

		const range = end.diff(start, 'days');
		console.log('previous selected range', { range });

		return {
			startDate: start.toDate(),
			endDate: end.toDate()
		} as IDateRangePicker;
	}
}
