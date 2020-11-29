import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpensesReportGridComponent } from './expenses-report-grid.component';
import { FormsModule } from '@angular/forms';
import {
	NbIconModule,
	NbSpinnerModule,
	NbCardModule,
	NbSelectModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../shared.module';
import { FiltersModule } from '../../timesheet/filters/filters.module';

@NgModule({
	declarations: [ExpensesReportGridComponent],
	exports: [ExpensesReportGridComponent],
	imports: [
		CommonModule,
		SharedModule,
		TranslateModule,
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		FiltersModule,
		NbSelectModule,
		FormsModule
	]
})
export class ExpensesReportGridModule {}
