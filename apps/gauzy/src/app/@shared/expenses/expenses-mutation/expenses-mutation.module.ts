import { ThemeModule } from '../../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { NbCardModule, NbButtonModule, NbIconModule, NbInputModule, NbDatepickerModule } from '@nebular/theme';
import { ExpensesMutationComponent } from './expenses-mutation.component';
import { NgSelectModule } from '@ng-select/ng-select';

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
        NbDatepickerModule
    ],
    exports: [ExpensesMutationComponent],
    declarations: [ExpensesMutationComponent],
    entryComponents: [ExpensesMutationComponent],
    providers: [
    ]
})
export class ExpensesMutationModule { }