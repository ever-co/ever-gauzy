import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NbBadgeModule, NbButtonModule, NbIconModule, NbTagModule, NbTooltipModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { PipesModule, StatusBadgeModule } from '@gauzy/ui-core/shared';
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
		TranslateModule.forChild(),
		PipesModule,
		StatusBadgeModule
	],
	declarations: [JobTitleDescriptionDetailsComponent, JobStatusComponent],
	exports: [JobTitleDescriptionDetailsComponent, JobStatusComponent]
})
export class JobTableComponentsModule {}
