import { IArrowStrategy, IDateRangeStrategy } from "../arrow-strategy.interface";
import * as moment from 'moment';

export class Future implements IArrowStrategy {
  /**
   * Implementation of action method
   * @param request
   * @returns any type of request
   */
	action(request: IDateRangeStrategy): IDateRangeStrategy {
		const start = moment(request.startDate);
		return {
			startDate: start.toDate(),
			endDate: moment().endOf('week').toDate()
		} as IDateRangeStrategy;
	}
}
