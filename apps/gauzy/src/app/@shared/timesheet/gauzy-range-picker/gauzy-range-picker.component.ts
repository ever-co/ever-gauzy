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

  constructor() { }

  ngOnInit(): void {
  }

  onUpdate(event: Object){
    this.onDateChange.emit(event);
  }

}
