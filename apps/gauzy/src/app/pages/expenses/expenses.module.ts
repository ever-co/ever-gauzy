import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import { NbCardModule, NbButtonModule, NbInputModule, NbIconModule, NbDialogModule } from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { ExpensesRoutingModule } from './expenses-routing.module';
import { ExpensesComponent } from './expenses.component';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { ExpensesMutationModule } from '../../@shared/expenses/expenses-mutation/expenses-mutation.module';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';

@NgModule({
    imports: [
        ExpensesRoutingModule,
        ThemeModule,
        NbCardModule,
        FormsModule,
        NbButtonModule,
        NbInputModule,
        NbIconModule,
        Ng2SmartTableModule,
        NbDialogModule.forChild(),
        ExpensesMutationModule,
        UserFormsModule
    ],
    declarations: [
        ExpensesComponent
    ]
})
export class ExpensesModule { }