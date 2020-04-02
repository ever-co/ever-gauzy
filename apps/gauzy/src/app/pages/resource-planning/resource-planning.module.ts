import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimeCalendarComponent } from './time-calendar/time-calendar.component';
import { ThemeModule } from '../../@theme/theme.module';
import {
	NbCardModule,
	NbCalendarModule,
	NbButtonModule,
	NbIconModule,
	NbLayoutModule,
	NbSelectModule
} from '@nebular/theme';
import { DayTitleCellComponent } from './time-calendar/day-title-cell/day-title-cell.component';
import { DayCellComponent } from './time-calendar/day-cell/day-cell.component';
import { DateService } from './date-service.service';
import { CalendarNavComponent } from './time-calendar/calendar-nav/calendar-nav.component';
import { DateRowComponent } from './time-calendar/date-row/date-row.component';
import { CalendarViewSelectComponent } from './time-calendar/calendar-view-select/calendar-view-select.component';
import { ResourcePlanningRoutingModule } from './resource-planning-routing.module';

@NgModule({
	declarations: [
		TimeCalendarComponent,
		DayTitleCellComponent,
		DayCellComponent,
		CalendarNavComponent,
		DateRowComponent,
		CalendarViewSelectComponent
	],
	imports: [
		CommonModule,
		ThemeModule,
		NbCardModule,
		NbCalendarModule,
		NbButtonModule,
		NbIconModule,
		NbLayoutModule,
		NbSelectModule,
		ResourcePlanningRoutingModule
	],
	providers: [DateService]
})
export class ResourcePlanningModule {}
