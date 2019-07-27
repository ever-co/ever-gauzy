import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import { NbCardModule, NbButtonModule, NbInputModule, NbIconModule, NbDialogModule } from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { EmployeesRoutingModule } from './employees-routing.module';
import { EmployeesComponent } from './employees.component';
import { OrganizationsService } from '../../@core/services/organizations.service';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { EmployeeMutationModule } from '../../@shared/employee/employee-mutation/employee-mutation.module';
import { EmployeeEndWorkModule } from '../../@shared/employee/employee-end-work-popup/employee-end-work.module';
import { EmployeeBonusComponent } from './table-components/employee-bonus/employee-bonus.component';
import { EmployeeFullNameComponent } from './table-components/employee-fullname/employee-fullname';

const COMPONENTS = [
    EmployeesComponent,
    EmployeeBonusComponent,
    EmployeeFullNameComponent
];

@NgModule({
    imports: [
        EmployeesRoutingModule,
        ThemeModule,
        NbCardModule,
        FormsModule,
        NbButtonModule,
        NbInputModule,
        NbIconModule,
        Ng2SmartTableModule,
        NbDialogModule.forChild(),
        EmployeeMutationModule,
        EmployeeEndWorkModule
    ],
    declarations: [
        ...COMPONENTS
    ],
    entryComponents: [
        EmployeeBonusComponent,
        EmployeeFullNameComponent
    ],
    providers: [
        OrganizationsService
    ]
})
export class EmployeesModule { }