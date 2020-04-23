// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarRoutingModule } from './calendar-routing.module';
import { CalendarComponent } from './calendar/calendar.component';
import { ShareModule } from 'apps/gauzy/src/app/share/share.module';
import { FullCalendarModule } from '@fullcalendar/angular';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
	declarations: [CalendarComponent],
	imports: [
		CommonModule,
		CalendarRoutingModule,
		ShareModule,
		FullCalendarModule,
		TranslateModule
	]
})
export class CalendarModule {}
