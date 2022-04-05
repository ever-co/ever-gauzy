import * as moment from 'moment';
import { IDateRangePicker } from "@gauzy/contracts";
import { IArrowStrategy } from "../arrow-strategy.interface";

export class Future implements IArrowStrategy {
  /**
   * Implementation of action method
   * @param request
   * @returns any type of request
   */
	action(request: IDateRangePicker): IDateRangePicker {
		const start = moment(request.startDate);
		return {
			startDate: start.toDate(),
			endDate: moment().endOf('week').toDate()
		} as IDateRangePicker;
	}
}
