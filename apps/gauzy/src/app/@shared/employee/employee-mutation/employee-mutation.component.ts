import { Component, OnInit, ViewChild } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { BasicInfoFormComponent } from '../../user/forms/basic-info/basic-info-form.component';
import { RolesEnum, Employee } from '@gauzy/models';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { EmployeesService } from '../../../@core/services/employees.service';
import { Store } from '../../../@core/services/store.service';
import { first } from 'rxjs/operators';

@Component({
    selector: 'ga-employee-mutation',
    templateUrl: 'employee-mutation.component.html',
    styleUrls: ['employee-mutation.component.scss'],
})
export class EmployeeMutationComponent implements OnInit {
    @ViewChild('userBasicInfo', { static: false })
    userBasicInfo: BasicInfoFormComponent;

    constructor(
        protected dialogRef: NbDialogRef<EmployeeMutationComponent>,
        protected organizationsService: OrganizationsService,
        protected employeesService: EmployeesService,
        protected store: Store
    ) { }

    ngOnInit(): void {
        console.warn("EmployeeMutationComponent");
    }

    closeDialog(employee: Employee = null) {
        this.dialogRef.close(employee)
    }

    async add() {
        try {
            const user = await this.userBasicInfo.registerUser(RolesEnum.EMPLOYEE);
            const organization = await this.organizationsService.getById(this.store.selectedOrganizationId).pipe(first()).toPromise();
            const employee = await this.employeesService.create({user, organization}).pipe(first()).toPromise();

            this.closeDialog(employee);
            
        } catch (err) {
            alert(err.error.detail.toString().replace(/[{()}]/g, ''));
        }
    }
}