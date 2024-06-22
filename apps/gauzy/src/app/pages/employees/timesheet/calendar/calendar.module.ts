// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbDialogModule, NbCardModule, NbButtonModule, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { FullCalendarModule } from '@fullcalendar/angular';
import { NgxPermissionsModule } from 'ngx-permissions';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { CalendarRoutingModule } from './calendar-routing.module';
import { CalendarComponent } from './calendar/calendar.component';
import { ShareModule } from './../../../../share/share.module';
import {
	EditTimeLogModalModule,
	i4netFiltersModule,
	SharedModule,
	ViewTimeLogModalModule
} from '@gauzy/ui-core/shared';

@NgModule({
	declarations: [CalendarComponent],
	imports: [
		CommonModule,
		I18nTranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		FullCalendarModule,
		NbButtonModule,
		NbCardModule,
		NbDialogModule,
		NbIconModule,
		NbSpinnerModule,
		CalendarRoutingModule,
		ShareModule,
		SharedModule,
		EditTimeLogModalModule,
		ViewTimeLogModalModule,
		i4netFiltersModule
	]
})
export class CalendarModule { }
