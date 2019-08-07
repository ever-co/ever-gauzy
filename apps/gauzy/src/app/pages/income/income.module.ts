import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import {
    NbCardModule,
    NbButtonModule,
    NbInputModule,
    NbDatepickerModule,
    NbIconModule,
    NbDialogModule
} from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IncomeComponent } from './income.component';
import { IncomeRoutingModule } from './income-routing.module';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { IncomeService } from '../../@core/services/income.service';
import { NgSelectModule } from '@ng-select/ng-select';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { IncomeMutationModule } from '../../@shared/income/income-mutation/income-mutation.module';
import { DateViewComponent } from './table-components/date-view/date-view.component';

@NgModule({
    imports: [
        IncomeRoutingModule,
        ThemeModule,
        NbCardModule,
        FormsModule,
        ReactiveFormsModule,
        NbButtonModule,
        NbInputModule,
        NbDatepickerModule,
        NbIconModule,
        Ng2SmartTableModule,
        NgSelectModule,
        NbDialogModule.forChild(),
        UserFormsModule,
        IncomeMutationModule
    ],
    entryComponents: [
        DateViewComponent
    ],
    declarations: [IncomeComponent, DateViewComponent],
    providers: [IncomeService]
})
export class IncomeModule { }
