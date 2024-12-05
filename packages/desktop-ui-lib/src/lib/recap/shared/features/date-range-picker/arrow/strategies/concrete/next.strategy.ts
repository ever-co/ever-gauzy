import * as moment from 'moment';
import { IDateRangePicker } from '@gauzy/contracts';
import { IArrowStrategy } from '../arrow-strategy.interface';

export class Next implements IArrowStrategy {
	// declaration of variable
	private disable: boolean = false;

	/**
	 * Implementation of action method
	 * @param request
	 * @returns any type of request
	 */
	action(request: IDateRangePicker, unitOfTime: moment.unitOfTime.Base): IDateRangePicker {
		const { startDate, endDate, isCustomDate } = request;
		let start: moment.Moment = moment(endDate).add(1, 'days');
		let end: moment.Moment;

		if (isCustomDate) {
			const range = moment(endDate).diff(moment(startDate), 'days');
			end = moment(start).add(range, 'days');
		} else {
			end = moment(start).endOf(unitOfTime);
		}

		return {
			startDate: start.startOf('day').toDate(),
			endDate: end.endOf('day').toDate(),
			isCustomDate
		} as IDateRangePicker;
	}
	/**
	 * getter of disable
	 */
	get isDisable(): boolean {
		return this.disable;
	}
	/**
	 * setter of enable
	 */
	set isDisable(disable: boolean) {
		this.disable = disable;
	}
}
