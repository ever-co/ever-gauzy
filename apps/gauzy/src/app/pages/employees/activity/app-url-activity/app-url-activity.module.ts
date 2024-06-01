import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NbSpinnerModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { AppUrlActivityRoutingModule } from './app-url-activity-routing.module';
import { AppUrlActivityComponent } from './app-url-activity/app-url-activity.component';
import { SharedModule } from './../../../../@shared/shared.module';
import { ActivityItemModule } from './../../../../@shared/timesheet/activities/activity-item/activity-item.module';
import { GauzyFiltersModule } from './../../../../@shared/timesheet/gauzy-filters/gauzy-filters.module';
import { NoDataMessageModule } from 'apps/gauzy/src/app/@shared/no-data-message/no-data-message.module';

@NgModule({
	declarations: [AppUrlActivityComponent],
	imports: [
		CommonModule,
		AppUrlActivityRoutingModule,
		NbSpinnerModule,
		TranslateModule.forChild(),
		SharedModule,
		ActivityItemModule,
		GauzyFiltersModule,
		NoDataMessageModule
	]
})
export class AppUrlActivityModule {}
