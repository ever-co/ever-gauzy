import { Component, Input } from '@angular/core';

@Component({
    templateUrl: './employee-bonus.component.html',
    standalone: false
})
export class EmployeeBonusComponent {
    @Input()
    rowData: any;

    value: string | number;
}
