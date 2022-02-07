import { Component, EventEmitter, Input, Output } from '@angular/core';
import * as moment from 'moment';
import { Arrow } from './arrow/context/arrow.class';
import { Next } from './arrow/strategies/concrete/next.strategy';
import { Previous } from './arrow/strategies/concrete/previous.strategy';

@Component({
  selector: 'ngx-gauzy-range-picker',
  templateUrl: './gauzy-range-picker.component.html',
  styleUrls: ['./gauzy-range-picker.component.scss']
})
export class GauzyRangePickerComponent {
  // declaration of variables
  private arrow: Arrow;
  private next: Next;
  public isDisable: boolean;
  // define ngx-daterangepicker-material range configuration
  ranges: any = {
    'Today': [moment(), moment()],
    'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
    'Last 7 Days': [moment().subtract(6, 'days'), moment()],
    'Last 30 Days': [moment().subtract(29, 'days'), moment()],
    'This Month': [moment().startOf('month'), moment().endOf('month')],
    'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
  }
  // ngx-daterangepicker-material local configuration
  localConfig: any = {
    displayFormat: 'MMM DD, YYYY',
  }
  // event emitter
  @Output()
  onDateChange: EventEmitter<Object> = new EventEmitter<Object>();
  // logRequest
  @Input()
  filters: any;
  // show or hide today button, show by default
  @Input()
  todayButton: boolean = true;
  // show or hide arrows button, hide by default
  @Input()
  arrows: boolean = false;
  /**
   * define constructor
   */
  constructor() {
    this.arrow = new Arrow();
    this.next = new Next();
  }
  /**
   * listen event on ngx-daterangepicker-material
   * @param event
   */
  onUpdate(event) {
    this.filters =
      event.endDate || event.startDate ?
        {
          startDate: event.startDate.toDate(),
          endDate: event.endDate.toDate()
        } : this.filters;
    this.updateNextButton();
    this.onDateChange.emit(this.filters);
  }
  /**
   * get today selected date
   */
  today() {
    this.filters = {
      startDate: moment().toDate(),
      endDate: moment().toDate()
    }
    this.updateNextButton();
    this.onDateChange.emit(this.filters);
  }
  /**
   * get next selected range
   */
  nextRange() {
    this.arrow.setStrategy = this.next;
    this.onDateChange.emit(this.arrow.execute(this.filters))
    this.isDisable = this.next.isDisable;
  }
  /**
   * get previous selected range
   */
  previousRange() {
    this.updateNextButton();
    this.arrow.setStrategy = new Previous();
    this.onDateChange.emit(this.arrow.execute(this.filters))
  }
  /**
   * update state: disable next button
   */
  updateNextButton() {
    if (this.next.isDisable) {
      this.next.isDisable = false;
      this.isDisable = false
    };
  }

}
