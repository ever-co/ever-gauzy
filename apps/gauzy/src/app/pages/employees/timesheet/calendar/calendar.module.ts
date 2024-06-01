// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbDialogModule, NbCardModule, NbButtonModule, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { FullCalendarModule } from '@fullcalendar/angular';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { CalendarRoutingModule } from './calendar-routing.module';
import { CalendarComponent } from './calendar/calendar.component';
import { ShareModule } from './../../../../share/share.module';
import { EmployeeSelectorsModule } from './../../../../@theme/components/header/selectors/employee/employee.module';
import { SharedModule } from './../../../../@shared/shared.module';
import { EditTimeLogModalModule, ViewTimeLogModalModule } from './../../../../@shared/timesheet';
import { GauzyFiltersModule } from './../../../../@shared/timesheet/gauzy-filters/gauzy-filters.module';

@NgModule({
	declarations: [CalendarComponent],
	imports: [
		CommonModule,
		TranslateModule.forChild(),
		FullCalendarModule,
		NbButtonModule,
		NbCardModule,
		NbDialogModule,
		NbIconModule,
		NbSpinnerModule,
		CalendarRoutingModule,
		ShareModule,
		EmployeeSelectorsModule,
		SharedModule,
		EditTimeLogModalModule,
		ViewTimeLogModalModule,
		GauzyFiltersModule
	]
})
export class CalendarModule {}
