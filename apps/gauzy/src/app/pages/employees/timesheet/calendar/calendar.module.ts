// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbDialogModule, NbCardModule, NbButtonModule, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { FullCalendarModule } from '@fullcalendar/angular';
import { NgxPermissionsModule } from 'ngx-permissions';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { CalendarRoutingModule } from './calendar-routing.module';
import { CalendarComponent } from './calendar/calendar.component';
import { ShareModule } from './../../../../share/share.module';
import { EditTimeLogModalModule, GauzyFiltersModule, SharedModule, ViewTimeLogModalModule } from '@gauzy/ui-sdk/shared';

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
		GauzyFiltersModule
	]
})
export class CalendarModule {}
