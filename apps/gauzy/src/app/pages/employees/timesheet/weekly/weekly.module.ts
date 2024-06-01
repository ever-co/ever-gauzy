// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
	NbDatepickerModule,
	NbIconModule,
	NbButtonModule,
	NbDialogModule,
	NbSpinnerModule,
	NbPopoverModule,
	NbCardModule,
	NbCheckboxModule
} from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';

import { WeeklyRoutingModule } from './weekly-routing.module';
import { WeeklyComponent } from './weekly/weekly.component';
import { ShareModule } from './../../../../share/share.module';

import { EmployeeSelectorsModule } from './../../../../@theme/components/header/selectors/employee/employee.module';
import { SharedModule } from './../../../../@shared/shared.module';
import { GauzyFiltersModule } from './../../../../@shared/timesheet/gauzy-filters/gauzy-filters.module';
import { EditTimeLogModalModule, ViewTimeLogModule } from 'apps/gauzy/src/app/@shared/timesheet';
import { TableComponentsModule } from 'apps/gauzy/src/app/@shared';
import { NoDataMessageModule } from 'apps/gauzy/src/app/@shared/no-data-message/no-data-message.module';

@NgModule({
	declarations: [WeeklyComponent],
	imports: [
		CommonModule,
		WeeklyRoutingModule,
		TranslateModule.forChild(),
		ShareModule,
		NbDatepickerModule,
		NbIconModule,
		EmployeeSelectorsModule,
		FormsModule,
		NbButtonModule,
		SharedModule,
		GauzyFiltersModule,
		EditTimeLogModalModule,
		NbDialogModule,
		NbSpinnerModule,
		NbButtonModule,
		NbPopoverModule,
		ViewTimeLogModule,
		NbCardModule,
		NbCheckboxModule,
		TableComponentsModule,
		NoDataMessageModule
	]
})
export class WeeklyModule {}
