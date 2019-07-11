import { ThemeModule } from '../../../@theme/theme.module';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { NbCardModule, NbButtonModule, NbIconModule } from '@nebular/theme';
import { UserFormsModule } from '../../user/forms/user-forms.module';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { EmployeesService } from '../../../@core/services/employees.service';
import { EmployeeEndWorkComponent } from './employee-end-work.component';

@NgModule({
    imports: [
        ThemeModule,
        FormsModule,
        NbCardModule,
        UserFormsModule,
        NbButtonModule,
        NbIconModule
    ],
    exports: [EmployeeEndWorkComponent],
    declarations: [EmployeeEndWorkComponent],
    entryComponents: [EmployeeEndWorkComponent],
    providers: [
        OrganizationsService,
        EmployeesService
    ]
})
export class EmployeeEndWorkModule { }