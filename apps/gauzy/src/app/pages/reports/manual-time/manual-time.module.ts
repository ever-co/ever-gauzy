import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbBadgeModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ManualTimeRoutingModule } from './manual-time-routing.module';
import { ManualTimeComponent } from './manual-time/manual-time.component';
import { SharedModule } from '../../../@shared/shared.module';
import { HeaderTitleModule } from '../../../@shared/components/header-title/header-title.module';
import { DateRangeTitleModule } from '../../../@shared/components/date-range-title/date-range-title.module';
import { GauzyFiltersModule } from '../../../@shared/timesheet/gauzy-filters/gauzy-filters.module';
import { ProjectColumnViewModule } from '../../../@shared/report/project-column-view/project-column-view.module';
import { NoDataMessageModule } from '../../../@shared/no-data-message/no-data-message.module';

@NgModule({
	declarations: [ManualTimeComponent],
	imports: [
		CommonModule,
		ManualTimeRoutingModule,
		SharedModule,
		I18nTranslateModule.forChild(),
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		FormsModule,
		ReactiveFormsModule,
		NbBadgeModule,
		HeaderTitleModule,
		DateRangeTitleModule,
		GauzyFiltersModule,
		ProjectColumnViewModule,
		NgSelectModule,
		NoDataMessageModule
	]
})
export class ManualTimeModule {}
