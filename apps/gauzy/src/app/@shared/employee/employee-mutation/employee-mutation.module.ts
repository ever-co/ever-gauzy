import { ThemeModule } from '../../../@theme/theme.module';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { NbCardModule, NbButtonModule, NbIconModule } from '@nebular/theme';
import { EmployeeMutationComponent } from './employee-mutation.component';
import { UserFormsModule } from '../../user/forms/user-forms.module';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { EmployeesService } from '../../../@core/services/employees.service';

@NgModule({
    imports: [
        ThemeModule,
        FormsModule,
        NbCardModule,
        UserFormsModule,
        NbButtonModule,
        NbIconModule
    ],
    exports: [EmployeeMutationComponent],
    declarations: [EmployeeMutationComponent],
    entryComponents: [EmployeeMutationComponent],
    providers: [
        OrganizationsService,
        EmployeesService
    ]
})
export class EmployeeMutationModule { }