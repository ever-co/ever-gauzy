import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { JobsRoutingModule } from './jobs-routing.module';

import { JobTitleDescriptionDetailsComponent } from './table-components';
import { JobLayoutComponent } from './job-layout/job-layout.component';
import { SharedModule } from '../../@shared/shared.module';

const COMPONENTS = [
	JobTitleDescriptionDetailsComponent
];

@NgModule({
	declarations: [
		...COMPONENTS,
		JobLayoutComponent
	],
	imports: [
		CommonModule,
		JobsRoutingModule,
		SharedModule
	]
})
export class JobsModule { }
