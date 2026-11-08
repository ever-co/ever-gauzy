import { NgModule } from '@angular/core';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbSpinnerModule,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslatePipe } from '@ngx-translate/core';
import {
	EditTimeLogModalModule,
	GauzyFiltersModule,
	NoDataMessageModule,
	ProjectColumnViewModule,
	SharedModule,
	TaskSelectModule
} from '@gauzy/ui-core/shared';
import { ManualTimeRoutingModule } from './manual-time-routing.module';
import { ManualTimeComponent } from './manual-time/manual-time.component';
import { ManualTimeDetailsComponent } from './manual-time-details/manual-time-details.component';

@NgModule({
	declarations: [ManualTimeComponent, ManualTimeDetailsComponent],
	imports: [
		ManualTimeRoutingModule,
		SharedModule,
		TranslatePipe,
		NbButtonModule,
		NbCardModule,
		NbDialogModule.forChild(),
		EditTimeLogModalModule,
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
