import * as moment from 'moment';
import { IDateRangePicker } from '@gauzy/contracts';
import { IArrowStrategy } from '../arrow-strategy.interface';

export class Previous implements IArrowStrategy {
	/**
	 * Implementation of action method
	 * @param request
	 * @returns any type of request
	 */
	action(request: IDateRangePicker, unitOfTime: moment.unitOfTime.Base): IDateRangePicker {
		const { startDate, endDate, isCustomDate } = request;
		let end: moment.Moment = moment(startDate).subtract(1, 'days');
		let start: moment.Moment;

		if (isCustomDate) {
			const range = moment(endDate).diff(moment(startDate), 'days');
			start = moment(end).subtract(range, 'days');
		} else {
			start = moment(end).startOf(unitOfTime);
		}
		return {
			startDate: start.startOf('day').toDate(),
			endDate: end.endOf('day').toDate(),
			isCustomDate
		} as IDateRangePicker;
	}
}
