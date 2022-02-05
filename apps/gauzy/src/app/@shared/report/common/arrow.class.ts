import * as moment from 'moment';
export class Arrow {
  // Define all variables
  private disabled: boolean;
  private logRequest: any;
  /**
   *
   * @param logRequest
   */
  constructor(logRequest: any){
    this.logRequest = logRequest;
  }
  /**
   * Next range date ahead the end date
   * @param today
   * @returns any
   */
   next(today: Date): any {
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
      endDate: moment(startDate).add(range, 'days').toDate(),
      employeeIds: this.logRequest.employeeIds,
      duration: this.logRequest.duration
    }
  }
  /**
   * Previous range date behind the end date
   */
  previous(): any {
    this.isDisable = false;
    const start = moment(this.logRequest.endDate);
    const end = moment(this.logRequest.startDate);
    const range = start.diff(end, 'days');
    const startDate = end.subtract(range, 'days').toDate();
    return this.logRequest = {
      startDate: startDate,
      endDate: moment(startDate).add(range, 'days').toDate(),
      employeeIds: this.logRequest.employeeIds,
      duration: this.logRequest.duration
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
  * Getter of logRequest
  */
  get getLogRequest(): any {
    return this.logRequest;
  }
  /**
   * Setter of logRequest
   */
  set setLogRequest(logRequest: any) {
    this.logRequest = logRequest;
  }
}
