import { IArrowStrategy, IDateRangeStrategy } from "../arrow-strategy.interface";
import * as moment from 'moment';

export class Next implements IArrowStrategy {
	// declaration of variable
	private disable: boolean = false;

	/**
	 * Implementation of action method
	 * @param request
	 * @returns any type of request
	 */
	action(request: any): IDateRangeStrategy {
		const end = moment(request.endDate);
		const start = moment(request.startDate);
		const range = end.diff(start, 'days');
		
		const startDate = range === 0 ? end.add(1, 'days').toDate() : start.add(range, 'days').toDate();
		const date = moment(startDate);

		if (date.isAfter(new Date())) {
			this.disable = true;
			return request;
		}
		return {
			startDate: startDate,
			endDate: moment(startDate).add(range, 'days').toDate()
		} as IDateRangeStrategy;
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
