import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AppUrlActivityRoutingModule } from './app-url-activity-routing.module';
import { AppUrlActivityComponent } from './app-url-activity/app-url-activity.component';
import { FiltersModule } from 'apps/gauzy/src/app/@shared/timesheet/filters/filters.module';
import { NbSpinnerModule, NbProgressBarModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from 'apps/gauzy/src/app/@shared/shared.module';

@NgModule({
	declarations: [AppUrlActivityComponent],
	imports: [
		CommonModule,
		AppUrlActivityRoutingModule,
		FiltersModule,
		NbSpinnerModule,
		NbProgressBarModule,
		TranslateModule,
		SharedModule
	]
})
export class AppUrlActivityModule {}
