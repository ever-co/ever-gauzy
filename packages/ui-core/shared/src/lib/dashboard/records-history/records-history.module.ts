import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { PaginationV2Module } from '../../smart-table/pagination/pagination-v2/pagination-v2.module';
import { RecordsHistoryComponent } from './records-history.component';

@NgModule({
	imports: [CommonModule, NbIconModule, NbSpinnerModule, NbCardModule, Angular2SmartTableModule, PaginationV2Module],
	exports: [RecordsHistoryComponent],
	declarations: [RecordsHistoryComponent]
})
export class RecordsHistoryModule {}
