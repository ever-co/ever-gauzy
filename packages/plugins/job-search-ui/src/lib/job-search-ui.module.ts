import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { JobSearchUiComponent } from './job-search-ui.component';
import { JobSearchUiService } from './job-search-ui.service';

@NgModule({
  imports: [CommonModule],
  declarations: [JobSearchUiComponent],
  exports: [JobSearchUiComponent],
  providers: [JobSearchUiService]
})
export class JobSearchUiModule {}
