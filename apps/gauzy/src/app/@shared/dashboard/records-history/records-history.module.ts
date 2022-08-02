import { NgModule } from '@angular/core';
import { RecordsHistoryComponent } from './records-history.component';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { IncomeModule } from '../../../pages/income/income.module';
import { NbCardModule, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { PaginationModule } from '../../pagination/pagination.module';
import { CommonModule } from '@angular/common';

@NgModule({
	imports: [
		CommonModule,
		Ng2SmartTableModule,
		IncomeModule,
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		PaginationModule
	],
	exports: [RecordsHistoryComponent],
	declarations: [RecordsHistoryComponent],
	providers: []
})
export class RecordsHistoryModule {}
