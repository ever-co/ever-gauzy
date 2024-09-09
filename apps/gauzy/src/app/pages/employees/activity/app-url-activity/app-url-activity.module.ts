import { NgModule } from '@angular/core';
import { NbSpinnerModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { AppUrlActivityRoutingModule } from './app-url-activity-routing.module';
import { AppUrlActivityComponent } from './app-url-activity/app-url-activity.component';
import { ActivityItemModule, GauzyFiltersModule, NoDataMessageModule, SharedModule } from '@gauzy/ui-core/shared';

@NgModule({
	declarations: [AppUrlActivityComponent],
	imports: [
		NbSpinnerModule,
		TranslateModule.forChild(),
		AppUrlActivityRoutingModule,
		SharedModule,
		ActivityItemModule,
		GauzyFiltersModule,
		NoDataMessageModule
	]
})
export class AppUrlActivityModule {}
