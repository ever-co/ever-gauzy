import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
    templateUrl: './employee-work-status.html',
    styleUrls: ['./employee-work-status.scss']
})
export class EmployeeWorkStatus implements ViewCell {
    @Input()
    rowData: any;
    value: string | number;
}
