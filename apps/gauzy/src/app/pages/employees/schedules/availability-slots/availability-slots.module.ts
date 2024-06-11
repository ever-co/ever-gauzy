// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbDialogModule, NbCardModule, NbButtonModule, NbIconModule, NbTooltipModule } from '@nebular/theme';
import { FullCalendarModule } from '@fullcalendar/angular';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { NgxPermissionsModule } from 'ngx-permissions';
import { AvailabilitySlotsRouteModule } from './availability-slots.routing.module';
import { AvailabilitySlotsComponent } from './availability-slots.component';
import { ShareModule } from './../../../../share/share.module';
import { SharedModule } from './../../../../@shared/shared.module';
import { ThemeModule } from './../../../../@theme/theme.module';
import { TimerPickerModule } from './../../../../@shared/timer-picker/timer-picker.module';

@NgModule({
	declarations: [AvailabilitySlotsComponent],
	imports: [
		CommonModule,
		AvailabilitySlotsRouteModule,
		ShareModule,
		NbIconModule,
		NbTooltipModule,
		ThemeModule,
		I18nTranslateModule.forChild(),
		FullCalendarModule,
		NbDialogModule,
		SharedModule,
		NbCardModule,
		NbButtonModule,
		TimerPickerModule,
		FormsModule,
		NgxPermissionsModule.forChild()
	]
})
export class AvailabilitySlotsModule {}
