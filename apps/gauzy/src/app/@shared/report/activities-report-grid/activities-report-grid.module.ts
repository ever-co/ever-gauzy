import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { ActivitiesReportGridComponent } from './activities-report-grid.component';
import { SharedModule } from '../../shared.module';
import { ProgressStatusModule } from '../../progress-status/progress-status.module';
import { ProjectColumnViewModule } from '../project-column-view/project-column-view.module';
import { NoDataMessageModule } from '../../no-data-message/no-data-message.module';

@NgModule({
	declarations: [ActivitiesReportGridComponent],
	exports: [ActivitiesReportGridComponent],
	imports: [
		CommonModule,
		SharedModule,
		TranslateModule.forChild(),
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		NbSelectModule,
		FormsModule,
		ProgressStatusModule,
		ProjectColumnViewModule,
		NoDataMessageModule
	]
})
export class ActivitiesReportGridModule {}
