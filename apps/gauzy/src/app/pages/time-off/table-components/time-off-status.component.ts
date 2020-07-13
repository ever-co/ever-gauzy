import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { TimeOff } from '@gauzy/models';

@Component({
	templateUrl: './time-off-status.component.html'
})
export class TimeOffStatusComponent implements ViewCell {
	@Input()
    rowData: TimeOff;

    value: string | number;
}