import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbCardModule, NbIconModule, NbSelectModule, NbSpinnerModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ActivitiesReportGridComponent } from './activities-report-grid.component';
import { ProgressStatusModule } from '../../progress-status/progress-status.module';
import { ProjectColumnViewModule } from '../project-column-view/project-column-view.module';
import { NoDataMessageModule } from '../../no-data-message/no-data-message.module';
import { SharedModule } from '../../shared.module';

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
		I18nTranslateModule.forChild(),
		SharedModule,
		ProgressStatusModule,
		ProjectColumnViewModule,
		NoDataMessageModule
	]
})
export class ActivitiesReportGridModule {}
