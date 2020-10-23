import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { JobsRoutingModule } from './jobs-routing.module';
import { JobLayoutComponent } from './job-layout/job-layout.component';

@NgModule({
	declarations: [JobLayoutComponent],
	imports: [CommonModule, JobsRoutingModule]
})
export class JobsModule {}
