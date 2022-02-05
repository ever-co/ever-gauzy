import { IGetPaymentInput } from "packages/contracts/dist";
import * as moment from 'moment';
export class Arrow {
  // Define all variables
  private disabled: boolean;
  private logRequest: IGetPaymentInput;
  // Define constructor
  constructor(logRequest: IGetPaymentInput){
    this.logRequest = logRequest;
  }
  /**
   * Next range date ahead the end date
   */
   next(today: Date): IGetPaymentInput {
    const start = moment(this.logRequest.endDate);
    const end = moment(this.logRequest.startDate);
    const range = start.diff(end, 'days');
    const startDate = end.add(range, 'days').toDate();
    const date = moment(startDate);
    if (date.isAfter(today)) {
      this.isDisable = true;
      return this.logRequest;
    }
    return this.logRequest = {
      startDate: startDate,
      endDate: moment(startDate).add(range, 'days').toDate()
    }
  }
  /**
   * Previous range date behind the end date
   */
  previous(): IGetPaymentInput {
    this.isDisable = false;
    const start = moment(this.logRequest.endDate);
    const end = moment(this.logRequest.startDate);
    const range = start.diff(end, 'days');
    const startDate = end.subtract(range, 'days').toDate();
    return this.logRequest = {
      startDate: startDate,
      endDate: moment(startDate).add(range, 'days').toDate(),
    }
  }
  /**
   * Getter of disable
   */
  get isDisable(): boolean {
    return this.disabled;
  }
  /**
   * Setter of disable
   */
  set isDisable(disabled: boolean) {
    this.disabled = disabled;
  }
  /**
  * Getter of disable
  */
  get getLogRequest(): IGetPaymentInput {
    return this.logRequest;
  }
  /**
   * Setter of disable
   */
  set setLogRequest(logRequest: IGetPaymentInput) {
    this.logRequest = logRequest;
  }
}
