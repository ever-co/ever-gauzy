import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbSpinnerModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { ActivityItemModule, GauzyFiltersModule, NoDataMessageModule, SharedModule } from '@gauzy/ui-core/shared';
import { AppUrlActivityRoutingModule } from './app-url-activity-routing.module';
import { AppUrlActivityComponent } from './app-url-activity/app-url-activity.component';

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
