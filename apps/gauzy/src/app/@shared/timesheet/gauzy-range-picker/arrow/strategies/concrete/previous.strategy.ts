import { IArrowStrategy } from "../arrow-strategy.interface";
import * as moment from 'moment';

export class Previous implements IArrowStrategy{
  /**
   * Implementation of action method
   * @param request
   * @returns any type of request
   */
  action(request: any): any {
    const end = moment(request.endDate);
    const start = moment(request.startDate);
    const range = end.diff(start, 'days');
    const startDate = range === 0 ? end.subtract(1, 'days').toDate() : start.subtract(range, 'days').toDate();
    return {
      startDate: startDate,
      endDate: moment(startDate).add(range, 'days').toDate(),
      employeeIds: request.employeeIds,
      duration: request.duration
    }
  }
}
