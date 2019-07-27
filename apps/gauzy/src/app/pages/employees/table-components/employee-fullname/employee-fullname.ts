import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
    templateUrl: './employee-fullname.component.html'
})
export class EmployeeFullNameComponent implements ViewCell {
    @Input()
    rowData: any;

    value: string | number;
}
