import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../shared.module';
import { ExpensesReportGridComponent } from './expenses-report-grid.component';
import { ProjectColumnViewModule } from '../project-column-view/project-column-view.module';
import { SmartDataViewLayoutModule } from '../../smart-data-layout/smart-data-view-layout.module';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		NbCardModule,
		NbIconModule,
		NbSelectModule,
		NbSpinnerModule,
		TranslateModule.forChild(),
		SharedModule,
		ProjectColumnViewModule,
		SmartDataViewLayoutModule
	],
	declarations: [ExpensesReportGridComponent],
	exports: [ExpensesReportGridComponent]
})
export class ExpensesReportGridModule {}
