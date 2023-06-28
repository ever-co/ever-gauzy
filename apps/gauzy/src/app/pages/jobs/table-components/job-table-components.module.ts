import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NbBadgeModule, NbIconModule, NbTagModule, NbTooltipModule } from '@nebular/theme';
import { SharedModule } from '../../../@shared/shared.module';
import { JobTitleDescriptionDetailsComponent } from './job-title-description-details/job-title-description-details.component';
import { JobStatusComponent } from './job-status/job-status.component';
import { StatusBadgeModule } from '../../../@shared/status-badge';

@NgModule({
	imports: [
		CommonModule,
		NbIconModule,
		NbTagModule,
		NbTooltipModule,
		NbBadgeModule,
		SharedModule,
		StatusBadgeModule
	],
	declarations: [
		JobTitleDescriptionDetailsComponent,
		JobStatusComponent
	],
	exports: [
		JobTitleDescriptionDetailsComponent,
		JobStatusComponent
	]
})
export class JobTableComponentsModule { }
