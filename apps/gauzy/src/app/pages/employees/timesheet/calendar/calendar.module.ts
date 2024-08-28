// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbDialogModule, NbCardModule, NbButtonModule, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { FullCalendarModule } from '@fullcalendar/angular';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import {
	EditTimeLogModalModule,
	GauzyFiltersModule,
	SharedModule,
	ViewTimeLogModalModule
} from '@gauzy/ui-core/shared';
import { CalendarRoutingModule } from './calendar-routing.module';
import { CalendarComponent } from './calendar/calendar.component';

@NgModule({
	declarations: [CalendarComponent],
	imports: [
		CommonModule,
		TranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		FullCalendarModule,
		NbButtonModule,
		NbCardModule,
		NbDialogModule,
		NbIconModule,
		NbSpinnerModule,
		CalendarRoutingModule,
		SharedModule,
		EditTimeLogModalModule,
		ViewTimeLogModalModule,
		GauzyFiltersModule
	]
})
export class CalendarModule {}
