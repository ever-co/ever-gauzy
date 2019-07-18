import { DashboardComponent } from './dashboard.component';
import { NgModule } from '@angular/core';
import { DashboardRoutingModule } from './dashboard-routing.module';
import { ThemeModule } from '../../@theme/theme.module';
import {
    NbCardModule,
    NbButtonModule,
    NbInputModule,
    NbDialogModule,
    NbTreeGridModule,
    NbIconModule,
    NbTooltipModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';
import { IncomeService } from '../../@core/services/income.service';
import { ExpensesService } from '../../@core/services/expenses.service';
import { AuthService } from '../../@core/services/auth.service';
import { RecordsHistoryModule } from '../../@shared/dashboard/records-history/records-history.module';

@NgModule({
    imports: [
        DashboardRoutingModule,
        ThemeModule,
        NbCardModule,
        NgSelectModule,
        FormsModule,
        NbButtonModule,
        NbInputModule,
        RecordsHistoryModule,
        NbDialogModule.forChild(),
        NbTreeGridModule,
        NbIconModule,
        NbTooltipModule
    ],
    declarations: [
        DashboardComponent
    ],
    providers: [IncomeService, ExpensesService, AuthService]
})
export class DashboardModule { }