// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbCardModule, NbDialogModule, NbIconModule, NbTooltipModule } from '@nebular/theme';
import { FullCalendarModule } from '@fullcalendar/angular';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { NgxPermissionsModule } from 'ngx-permissions';
import { SharedModule, TimerPickerModule } from '@gauzy/ui-core/shared';
import { AvailabilitySlotsRouteModule } from './availability-slots.routing.module';
import { AvailabilitySlotsComponent } from './availability-slots.component';

@NgModule({
	declarations: [AvailabilitySlotsComponent],
	imports: [
		CommonModule,
		FormsModule,
		NbButtonModule,
		NbCardModule,
		NbDialogModule,
		NbIconModule,
		NbTooltipModule,
		FullCalendarModule,
		I18nTranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		AvailabilitySlotsRouteModule,
		SharedModule,
		TimerPickerModule
	]
})
export class AvailabilitySlotsModule {}
