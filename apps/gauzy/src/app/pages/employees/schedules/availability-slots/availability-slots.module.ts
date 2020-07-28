// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AvailabilitySlotsRouteModule } from './availability-slots.routing.module';
import { AvailabilitySlotsComponent } from './availability-slots.component';
import { ShareModule } from 'apps/gauzy/src/app/share/share.module';
import { FullCalendarModule } from '@fullcalendar/angular';
import { TranslateModule } from '@ngx-translate/core';
import { EmployeeSelectorsModule } from 'apps/gauzy/src/app/@theme/components/header/selectors/employee/employee.module';
import {
	NbDialogModule,
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbTooltipModule
} from '@nebular/theme';
import { SharedModule } from 'apps/gauzy/src/app/@shared/shared.module';
import { ThemeModule } from 'apps/gauzy/src/app/@theme/theme.module';

@NgModule({
	declarations: [AvailabilitySlotsComponent],
	imports: [
		CommonModule,
		AvailabilitySlotsRouteModule,
		ShareModule,
		NbIconModule,
		NbTooltipModule,
		ThemeModule,
		FullCalendarModule,
		TranslateModule,
		EmployeeSelectorsModule,
		NbDialogModule,
		SharedModule,
		NbCardModule,
		NbButtonModule
	]
})
export class AvailabilitySlotsModule {}
