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
import { TranslateModule } from '@ngx-translate/core';

import { WeeklyRoutingModule } from './weekly-routing.module';
import { WeeklyComponent } from './weekly/weekly.component';
import { ShareModule } from './../../../../share/share.module';

import { EmployeeSelectorsModule } from './../../../../@theme/components/header/selectors/employee/employee.module';
import { SharedModule } from './../../../../@shared/shared.module';
import { GauzyFiltersModule } from './../../../../@shared/timesheet/gauzy-filters/gauzy-filters.module';
import { EditTimeLogModalModule, ViewTimeLogModule } from 'apps/gauzy/src/app/@shared/timesheet';
import { TableComponentsModule } from 'apps/gauzy/src/app/@shared';

@NgModule({
	declarations: [WeeklyComponent],
	imports: [
		CommonModule,
		WeeklyRoutingModule,
		TranslateModule,
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
		TableComponentsModule
	]
})
export class WeeklyModule {}
