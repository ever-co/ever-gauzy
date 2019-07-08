import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import {
  NbCardModule,
  NbButtonModule,
  NbInputModule,
  NbDatepickerModule,
  NbIconModule
} from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IncomeComponent } from './income.component';
import { IncomeRoutingModule } from './income-routing.module';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { IncomeService } from '../../@core/services/income.service';
import { NgSelectModule } from '@ng-select/ng-select';

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
    NgSelectModule
  ],
  declarations: [IncomeComponent],
  providers: [IncomeService]
})
export class IncomeModule { }
