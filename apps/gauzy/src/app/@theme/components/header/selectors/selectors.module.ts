import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CompanySelectorComponent } from './company/company.component';
import { EmployeeSelectorComponent } from './employee/employee.component';
import { DateSelectorComponent } from './date/date.component';
import { NgSelectModule } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';
import { NbCardModule, NbCalendarModule, NbCalendarKitModule, NbDatepickerModule, NbInputModule, NbButtonModule } from '@nebular/theme';

const COMPONENTS = [
    CompanySelectorComponent,
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
    providers: []
})
export class HeaderSelectorsModule {
}