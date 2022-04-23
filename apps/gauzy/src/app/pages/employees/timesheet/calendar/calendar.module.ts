// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarRoutingModule } from './calendar-routing.module';
import { CalendarComponent } from './calendar/calendar.component';
import { ShareModule } from './../../../../share/share.module';
import { FullCalendarModule } from '@fullcalendar/angular';
import { TranslateModule } from '@ngx-translate/core';
import { EmployeeSelectorsModule } from './../../../../@theme/components/header/selectors/employee/employee.module';
import {
	NbDialogModule,
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbSpinnerModule
} from '@nebular/theme';
import { SharedModule } from './../../../../@shared/shared.module';
import { EditTimeLogModalModule, ViewTimeLogModalModule } from './../../../../@shared/timesheet';
import { GauzyFiltersModule } from './../../../../@shared/timesheet/gauzy-filters/gauzy-filters.module';

@NgModule({
	declarations: [CalendarComponent],
	imports: [
		CommonModule,
		CalendarRoutingModule,
		ShareModule,
		FullCalendarModule,
		TranslateModule,
		EmployeeSelectorsModule,
		NbDialogModule,
		SharedModule,
		NbCardModule,
		NbButtonModule,
		EditTimeLogModalModule,
		ViewTimeLogModalModule,
		GauzyFiltersModule,
		NbIconModule,
		NbSpinnerModule
	]
})
export class CalendarModule {}
