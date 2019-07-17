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
    UserFormsModule
  ],
  declarations: [IncomeComponent],
  providers: [IncomeService]
})
export class IncomeModule { }
