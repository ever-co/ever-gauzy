import { NgModule } from '@angular/core';
import { RecordsHistoryComponent } from './records-history.component';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { IncomeModule } from '../../../pages/income/income.module';
import { NbCardModule, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { PaginationModule } from '../../pagination/pagination.module';
import { CommonModule } from '@angular/common';

@NgModule({
	imports: [
		CommonModule,
		Angular2SmartTableModule,
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
export class RecordsHistoryModule { }
