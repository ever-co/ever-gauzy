import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { CalendarRoutingModule } from './calendar-routing.module';
import { CalendarComponent } from './calendar/calendar.component';

@NgModule({
	declarations: [CalendarComponent],
	imports: [CommonModule, CalendarRoutingModule]
})
export class CalendarModule {}
