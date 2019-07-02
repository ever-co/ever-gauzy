import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import {
  NbCardModule,
  NbButtonModule,
  NbInputModule,
  NbDatepickerModule,
  NbIconModule
} from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { IncomeComponent } from './income.component';
import { IncomeRoutingModule } from './income-routing.module';
import { Ng2SmartTableModule } from 'ng2-smart-table';

@NgModule({
  imports: [
    IncomeRoutingModule,
    ThemeModule,
    NbCardModule,
    FormsModule,
    NbButtonModule,
    NbInputModule,
    NbDatepickerModule,
    NbIconModule,
    Ng2SmartTableModule
  ],
  declarations: [IncomeComponent]
})
export class IncomeModule {}
