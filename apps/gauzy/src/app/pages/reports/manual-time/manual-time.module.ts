import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbBadgeModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { i4netFiltersModule, NoDataMessageModule, ProjectColumnViewModule, SharedModule } from '@gauzy/ui-core/shared';
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
		i4netFiltersModule,
		ProjectColumnViewModule,
		NoDataMessageModule
	]
})
export class ManualTimeModule { }
