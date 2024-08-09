import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbCardModule, NbIconModule, NbSelectModule, NbSpinnerModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { ActivitiesReportGridComponent } from './activities-report-grid.component';
import { ProgressStatusModule } from '../../progress-status/progress-status.module';
import { ProjectColumnViewModule } from '../project-column-view/project-column-view.module';
import { SmartDataViewLayoutModule } from '../../smart-data-layout/smart-data-view-layout.module';
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
		TranslateModule.forChild(),
		SharedModule,
		ProgressStatusModule,
		ProjectColumnViewModule,
		SmartDataViewLayoutModule
	]
})
export class ActivitiesReportGridModule {}
