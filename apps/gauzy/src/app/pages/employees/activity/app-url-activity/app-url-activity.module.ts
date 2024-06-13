import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NbSpinnerModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { AppUrlActivityRoutingModule } from './app-url-activity-routing.module';
import { AppUrlActivityComponent } from './app-url-activity/app-url-activity.component';
import { ActivityItemModule, GauzyFiltersModule, NoDataMessageModule, SharedModule } from '@gauzy/ui-sdk/shared';

@NgModule({
	declarations: [AppUrlActivityComponent],
	imports: [
		CommonModule,
		AppUrlActivityRoutingModule,
		NbSpinnerModule,
		I18nTranslateModule.forChild(),
		SharedModule,
		ActivityItemModule,
		GauzyFiltersModule,
		NoDataMessageModule
	]
})
export class AppUrlActivityModule {}
