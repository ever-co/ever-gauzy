import * as moment from 'moment';
import { IDateRangePicker } from "@gauzy/contracts";
import { IArrowStrategy } from "../arrow-strategy.interface";

export class Next implements IArrowStrategy {
	// declaration of variable
	private disable: boolean = false;

	/**
	 * Implementation of action method
	 * @param request
	 * @returns any type of request
	 */
	action(request: any): IDateRangePicker {
		const end = moment(request.endDate);
		const start = moment(request.startDate);
		const range = end.diff(start, 'days');
		
		const startDate = range === 0 ? end.add(1, 'days').toDate() : start.add(range, 'days').toDate();
		return {
			startDate: startDate,
			endDate: moment(startDate).add(range, 'days').toDate()
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
