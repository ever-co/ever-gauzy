import { ThemeModule } from '../../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { NbCardModule, NbButtonModule, NbIconModule, NbInputModule, NbDatepickerModule, NbSelectModule } from '@nebular/theme';
import { EmployeeRecurringExpenseMutationComponent } from './employee-recurring-expense-mutation.component';
import { NgSelectModule } from '@ng-select/ng-select';
import { OrganizationsService } from '../../../@core/services/organizations.service';

@NgModule({
    imports: [
        ThemeModule,
        FormsModule,
        ReactiveFormsModule,
        NbCardModule,
        NbButtonModule,
        NbIconModule,
        NbInputModule,
        NbDatepickerModule,
        NgSelectModule,
        NbSelectModule
    ],
    exports: [EmployeeRecurringExpenseMutationComponent],
    declarations: [EmployeeRecurringExpenseMutationComponent],
    entryComponents: [EmployeeRecurringExpenseMutationComponent],
    providers: [
        OrganizationsService
    ]
})
export class EmployeeRecurringExpenseMutationModule { }