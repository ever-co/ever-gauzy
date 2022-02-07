import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import * as moment from 'moment';

@Component({
  selector: 'ngx-gauzy-range-picker',
  templateUrl: './gauzy-range-picker.component.html',
  styleUrls: ['./gauzy-range-picker.component.scss']
})
export class GauzyRangePickerComponent implements OnInit {
  ranges: any = {
    'Today': [moment(), moment()],
    'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
    'Last 7 Days': [moment().subtract(6, 'days'), moment()],
    'Last 30 Days': [moment().subtract(29, 'days'), moment()],
    'This Month': [moment().startOf('month'), moment().endOf('month')],
    'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
  }

  localConfig: any = {
    displayFormat: 'MMM DD, YYYY',
  }

  @Output()
  onDateChange: EventEmitter<Object> = new EventEmitter<Object>();

  @Input()
  filters: any;

  @Input()
  todayButton: boolean = true;

  constructor() { }

  ngOnInit(): void {
  }

  onUpdate(event){
    const requestEvent =
      event.endDate || event.startDate ?
        {
          startDate: event.startDate.toDate(),
          endDate: event.endDate.toDate()
        } : this.filters;
    this.onDateChange.emit(requestEvent);
  }

  today(){
    this.filters = {
      startDate: moment(),
      endDate: moment()
    }
    this.onDateChange.emit(this.filters);
  }
}
