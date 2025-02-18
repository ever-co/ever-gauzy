import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbCardModule, NbIconModule, NbSelectModule, NbSpinnerModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../shared.module';
import { NoDataMessageModule } from '../../smart-data-layout/no-data-message/no-data-message.module';
import { ActivitiesReportGridComponent } from './activities-report-grid.component';
import { ProgressStatusModule } from '../../progress-status/progress-status.module';
import { ProjectColumnViewModule } from '../project-column-view/project-column-view.module';

@NgModule({
	declarations: [ActivitiesReportGridComponent],
	exports: [ActivitiesReportGridComponent],
	imports: [
		CommonModule,
		FormsModule,
		NbCardModule,
		NbIconModule,
		NbSelectModule,
		NbSpinnerModule,
		TranslateModule.forChild(),
		SharedModule,
		ProgressStatusModule,
		ProjectColumnViewModule,
		NoDataMessageModule,
		NbButtonModule
	]
})
export class ActivitiesReportGridModule {}
