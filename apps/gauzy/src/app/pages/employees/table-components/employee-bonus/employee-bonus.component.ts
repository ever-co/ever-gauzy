import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
    templateUrl: './employee-bonus.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class EmployeeBonusComponent {
    @Input()
    rowData: any;

    value: string | number;
}
