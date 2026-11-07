import { NgModule } from '@angular/core';
import {
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbSpinnerModule,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslatePipe } from '@ngx-translate/core';
import {
	GauzyFiltersModule,
	NoDataMessageModule,
	ProjectColumnViewModule,
	SharedModule,
	TaskSelectModule
} from '@gauzy/ui-core/shared';
import { ManualTimeRoutingModule } from './manual-time-routing.module';
import { ManualTimeComponent } from './manual-time/manual-time.component';

@NgModule({
	declarations: [ManualTimeComponent],
	imports: [
		ManualTimeRoutingModule,
		SharedModule,
		TranslatePipe,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbSpinnerModule,
		NbToggleModule,
		NbTooltipModule,
		NgSelectModule,
		GauzyFiltersModule,
		ProjectColumnViewModule,
		NoDataMessageModule,
		TaskSelectModule
	]
})
export class ManualTimeModule {}
