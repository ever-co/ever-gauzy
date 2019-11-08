import { NgModule } from '@angular/core';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { IncomeModule } from '../../../pages/income/income.module';
import { NbEvaIconsModule } from '@nebular/eva-icons';
import { NbIconModule } from '@nebular/theme';
import { ProfitHistoryComponent } from './profit-history.component';

@NgModule({
	imports: [Ng2SmartTableModule, IncomeModule, NbIconModule],
	exports: [ProfitHistoryComponent],
	declarations: [ProfitHistoryComponent],
	entryComponents: [ProfitHistoryComponent],
	providers: [ProfitHistoryComponent]
})
export class ProfitHistoryModule {}
