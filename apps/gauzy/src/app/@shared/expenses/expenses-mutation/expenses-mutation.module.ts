import { ThemeModule } from '../../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { NbCardModule, NbButtonModule, NbIconModule, NbInputModule, NbDatepickerModule, NbSelectModule } from '@nebular/theme';
import { ExpensesMutationComponent } from './expenses-mutation.component';
import { NgSelectModule } from '@ng-select/ng-select';
import { OrganizationsService } from '../../../@core/services/organizations.service';

@NgModule({
    imports: [
        ThemeModule,
        NbCardModule,
        NbButtonModule,
        NbIconModule,
        NgSelectModule,
        ReactiveFormsModule,
        NbInputModule,
        FormsModule,
        NbDatepickerModule,
        NbSelectModule
    ],
    exports: [ExpensesMutationComponent],
    declarations: [ExpensesMutationComponent],
    entryComponents: [ExpensesMutationComponent],
    providers: [
        OrganizationsService
    ]
})
export class ExpensesMutationModule { }