import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NbIconModule, NbTagModule, NbTooltipModule } from '@nebular/theme';
import { JobTitleDescriptionDetailsComponent } from './job-title-description-details/job-title-description-details.component';
import { SharedModule } from '../../../@shared/shared.module';

@NgModule({
	imports: [CommonModule, NbIconModule, NbTooltipModule, NbTagModule, SharedModule],
	declarations: [JobTitleDescriptionDetailsComponent],
	exports: [JobTitleDescriptionDetailsComponent]
})
export class JobTableComponentsModule { }
