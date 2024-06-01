// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FullCalendarModule } from '@fullcalendar/angular';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { NgxPermissionsModule } from 'ngx-permissions';
import { AvailabilitySlotsRouteModule } from './availability-slots.routing.module';
import { AvailabilitySlotsComponent } from './availability-slots.component';
import { ShareModule } from './../../../../share/share.module';
import { EmployeeSelectorsModule } from './../../../../@theme/components/header/selectors/employee/employee.module';
import { NbDialogModule, NbCardModule, NbButtonModule, NbIconModule, NbTooltipModule } from '@nebular/theme';
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
		TranslateModule.forChild(),
		FullCalendarModule,
		EmployeeSelectorsModule,
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
