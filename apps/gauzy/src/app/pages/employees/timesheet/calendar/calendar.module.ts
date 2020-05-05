// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarRoutingModule } from './calendar-routing.module';
import { CalendarComponent } from './calendar/calendar.component';
import { ShareModule } from 'apps/gauzy/src/app/share/share.module';
import { FullCalendarModule } from '@fullcalendar/angular';
import { TranslateModule } from '@ngx-translate/core';
import { EmployeeSelectorsModule } from 'apps/gauzy/src/app/@theme/components/header/selectors/employee/employee.module';
import { NbDialogModule, NbCardModule, NbButtonModule } from '@nebular/theme';
import { SharedModule } from 'apps/gauzy/src/app/@shared/shared.module';

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
		NbButtonModule
	]
})
export class CalendarModule {}
