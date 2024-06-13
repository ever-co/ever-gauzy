import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbBadgeModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { GauzyFiltersModule, NoDataMessageModule, ProjectColumnViewModule, SharedModule } from '@gauzy/ui-sdk/shared';
import { ManualTimeRoutingModule } from './manual-time-routing.module';
import { ManualTimeComponent } from './manual-time/manual-time.component';

@NgModule({
	declarations: [ManualTimeComponent],
	imports: [
		CommonModule,
		FormsModule,
		ManualTimeRoutingModule,
		SharedModule,
		I18nTranslateModule.forChild(),
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		NgSelectModule,
		ReactiveFormsModule,
		NbBadgeModule,
		GauzyFiltersModule,
		ProjectColumnViewModule,
		NoDataMessageModule
	]
})
export class ManualTimeModule {}
