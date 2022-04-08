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
	action(
		request: IDateRangePicker,
		unitOfTime: moment.unitOfTime.Base
	): IDateRangePicker {
		const { endDate } = request;
		const start = moment(endDate).add(1, 'days');
		const end = moment(start).endOf(unitOfTime);

		const range = end.diff(start, 'days');
		console.log('next selected range', { range });

		return {
			startDate: start.toDate(),
			endDate: end.toDate()
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
