import { Component } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';

@Component({
    selector: 'ga-employee-end-work',
    templateUrl: 'employee-end-work.component.html',
    styleUrls: ['employee-end-work.component.scss'],
})
export class EmployeeEndWorkComponent {
    backToWork: boolean;
    endWorkValue: Date;
    employeeFullName: string;

    constructor(
        protected dialogRef: NbDialogRef<EmployeeEndWorkComponent>
    ) { }

    closeDialog() {
        this.dialogRef.close();
    }

    endWork() {
        this.dialogRef.close(this.endWorkValue || new Date());
    }
}