import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { JobSearchUiModule } from '@gauzy/plugins/job-search-ui';
import { SharedModule } from '@gauzy/ui-core/shared';
import { JobsRoutingModule } from './jobs-routing.module';
import { JobLayoutComponent } from './job-layout/job-layout.component';
import { JobTableComponentsModule } from './table-components/job-table-components.module';

@NgModule({
	declarations: [JobLayoutComponent],
	imports: [CommonModule, JobsRoutingModule, SharedModule, JobTableComponentsModule, JobSearchUiModule]
})
export class JobsModule {}
