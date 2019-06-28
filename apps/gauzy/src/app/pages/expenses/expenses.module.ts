import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import { NbCardModule, NbButtonModule, NbInputModule } from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { ExpensesRoutingModule } from './expenses-routing.module';
import { ExpensesComponent } from './expenses.component';

@NgModule({
    imports: [
        ExpensesRoutingModule,
        ThemeModule,
        NbCardModule,
        FormsModule,
        NbButtonModule,
        NbInputModule,
    ],
    declarations: [
        ExpensesComponent
    ]
})
export class ExpensesModule { }