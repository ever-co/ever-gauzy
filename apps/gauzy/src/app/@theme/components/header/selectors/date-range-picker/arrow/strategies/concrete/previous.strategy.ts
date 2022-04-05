import * as moment from 'moment';
import { IDateRangePicker } from "@gauzy/contracts";
import { IArrowStrategy } from "../arrow-strategy.interface";

export class Previous implements IArrowStrategy {
	/**
	 * Implementation of action method
	 * @param request
	 * @returns any type of request
	 */
	action(request: IDateRangePicker): IDateRangePicker {
		const end = moment(request.endDate);
		const start = moment(request.startDate);
		const range = end.diff(start, 'days');

		const startDate = range === 0 ? end.subtract(1, 'days').toDate() : start.subtract(range, 'days').toDate();
		return {
			startDate: startDate,
			endDate: moment(startDate).add(range, 'days').toDate()
		} as IDateRangePicker;
	}
}
