import { NgModule } from '@angular/core';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbBadgeModule, NbButtonModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { GauzyFiltersModule, NoDataMessageModule, ProjectColumnViewModule, SharedModule } from '@gauzy/ui-core/shared';
import { ManualTimeRoutingModule } from './manual-time-routing.module';
import { ManualTimeComponent } from './manual-time/manual-time.component';

@NgModule({
	declarations: [ManualTimeComponent],
	imports: [
		ManualTimeRoutingModule,
		SharedModule,
		TranslateModule.forChild(),
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		NgSelectModule,
		NbBadgeModule,
		GauzyFiltersModule,
		ProjectColumnViewModule,
		NoDataMessageModule,
		NbButtonModule
	]
})
export class ManualTimeModule {}
