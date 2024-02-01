import { NgModule } from '@angular/core';
import { RecordsHistoryComponent } from './records-history.component';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { IncomeModule } from '../../../pages/income/income.module';
import { NbCardModule, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { PaginationV2Module } from "../../../@shared/pagination/pagination-v2/pagination-v2.module";
import { CommonModule } from '@angular/common';

@NgModule({
	imports: [
		CommonModule,
		Angular2SmartTableModule,
		IncomeModule,
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		PaginationV2Module
	],
	exports: [RecordsHistoryComponent],
	declarations: [RecordsHistoryComponent],
	providers: []
})
export class RecordsHistoryModule { }
