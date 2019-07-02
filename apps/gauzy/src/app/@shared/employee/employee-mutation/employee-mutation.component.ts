import { Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';

@Component({
    selector: 'ga-employee-mutation',
    templateUrl: 'employee-mutation.component.html',
    styleUrls: ['employee-mutation.component.scss'],
})
export class EmployeeMutationComponent implements OnInit {
    constructor(
        protected dialogRef: NbDialogRef<EmployeeMutationComponent>
    ) { }

    ngOnInit(): void {
        console.warn("EmployeeMutationComponent");
    }

    closeDialog() {
        this.dialogRef.close()
    }
}