import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NbBadgeModule, NbButtonModule, NbIconModule, NbTagModule, NbTooltipModule } from '@nebular/theme';
import { SharedModule } from '../../../@shared/shared.module';
import { StatusBadgeModule } from '../../../@shared/status-badge';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { JobTitleDescriptionDetailsComponent } from './job-title-description-details/job-title-description-details.component';
import { JobStatusComponent } from './job-status/job-status.component';

@NgModule({
	imports: [
		CommonModule,
		NbBadgeModule,
		NbButtonModule,
		NbIconModule,
		NbTagModule,
		NbTooltipModule,
		SharedModule,
		I18nTranslateModule.forChild(),
		StatusBadgeModule
	],
	declarations: [JobTitleDescriptionDetailsComponent, JobStatusComponent],
	exports: [JobTitleDescriptionDetailsComponent, JobStatusComponent]
})
export class JobTableComponentsModule {}
