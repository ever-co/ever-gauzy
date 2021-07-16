import { NgModule } from '@angular/core';
import { RecordsHistoryComponent } from './records-history.component';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { IncomeModule } from '../../../pages/income/income.module';
import { NbIconModule, NbSpinnerModule } from '@nebular/theme';

@NgModule({
	imports: [Ng2SmartTableModule, IncomeModule, NbIconModule, NbSpinnerModule],
	exports: [RecordsHistoryComponent],
	declarations: [RecordsHistoryComponent],
	providers: []
})
export class RecordsHistoryModule {}
