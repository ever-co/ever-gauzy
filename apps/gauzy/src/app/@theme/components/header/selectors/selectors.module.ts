import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmployeeSelectorComponent } from './employee/employee.component';
import { DateSelectorComponent } from './date/date.component';
import { NgSelectModule } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';
import { NbCardModule, NbCalendarModule, NbCalendarKitModule, NbDatepickerModule, NbInputModule, NbButtonModule } from '@nebular/theme';
import { OrganizationSelectorComponent } from './organization/organization.component';
import { OrganizationsService } from 'apps/gauzy/src/app/@core/services/organizations.service';

const COMPONENTS = [
    OrganizationSelectorComponent,
    DateSelectorComponent,
    EmployeeSelectorComponent
];

@NgModule({
    imports: [
        CommonModule,
        NgSelectModule,
        FormsModule,
        NbCardModule,
        NbCalendarModule,
        NbCalendarKitModule,
        NbDatepickerModule,
        NbInputModule,
        NbButtonModule
    ],
    exports: [...COMPONENTS],
    declarations: [...COMPONENTS],
    providers: [OrganizationsService]
})
export class HeaderSelectorsModule {
}