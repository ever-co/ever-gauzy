import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NgSelectModule } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';
import { EmployeeSelectorComponent } from './employee.component';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services/employees.service';

const COMPONENTS = [
    EmployeeSelectorComponent
];

@NgModule({
    imports: [
        CommonModule,
        NgSelectModule,
        FormsModule,
    ],
    exports: [...COMPONENTS],
    declarations: [...COMPONENTS],
    providers: [EmployeesService]
})
export class EmployeeSelectorsModule {
}