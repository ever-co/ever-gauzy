import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { JobSearchUiComponent } from './job-search/job-search-ui.component';

@NgModule({
	imports: [CommonModule],
	declarations: [JobSearchUiComponent],
	exports: [JobSearchUiComponent]
})
export class JobSearchUiModule {}
