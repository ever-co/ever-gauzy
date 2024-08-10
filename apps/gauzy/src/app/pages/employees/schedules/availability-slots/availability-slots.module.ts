// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { NbButtonModule, NbCardModule, NbDialogModule, NbIconModule, NbTooltipModule } from '@nebular/theme';
import { FullCalendarModule } from '@fullcalendar/angular';
import { TranslateModule } from '@ngx-translate/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { SharedModule, TimerPickerModule } from '@gauzy/ui-core/shared';
import { AvailabilitySlotsRouteModule } from './availability-slots.routing.module';
import { AvailabilitySlotsComponent } from './availability-slots.component';

@NgModule({
	declarations: [AvailabilitySlotsComponent],
	imports: [
		NbButtonModule,
		NbCardModule,
		NbDialogModule,
		NbIconModule,
		NbTooltipModule,
		FullCalendarModule,
		TranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		AvailabilitySlotsRouteModule,
		SharedModule,
		TimerPickerModule
	]
})
export class AvailabilitySlotsModule {}
