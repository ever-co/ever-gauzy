import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { PaginationV2Module } from '@gauzy/ui-sdk/shared';
import { RecordsHistoryComponent } from './records-history.component';
import { IncomeModule } from '../../../pages/income/income.module';

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
export class RecordsHistoryModule {}
